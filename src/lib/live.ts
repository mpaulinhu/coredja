/**
 * Contrato de dados das mensagens da transmissão ao vivo.
 *
 * A tela "Ao Vivo" existe para um momento específico: a live rodando, alguém
 * com o chat do YouTube aberto do lado, precisando colar "Seja bem-vindo!
 * Compartilhe com um amigo" antes que o momento passe. O destino é sempre a
 * área de transferência — o Coredja não fala com o YouTube nem com o
 * Instagram; ele guarda o texto pronto e entrega num clique.
 *
 * Por isso o modelo é deliberadamente magro: texto, categoria e quando foi
 * criada. Nada de agendamento (como `dias` em `avisos.ts`) nem de "no ar"
 * (como `noAr`) — uma mensagem da live não tem estado, ela é copiada e
 * pronto, quantas vezes forem precisas.
 */

/** Quantas vezes qualquer mensagem pode ter sido copiada — teto de sanidade. */
const MAXIMO_COPIAS = 1_000_000;

export interface MensagemDaLive {
  id: string;
  texto: string;
  /**
   * A pasta onde a mensagem fica na tela — "Abertura", "Ofertas",
   * "Encerramento".
   *
   * É texto livre, não uma lista fixa no código, pela mesma razão que fez a
   * tela de Departamentos existir: uma lista fixa obriga a mexer em código
   * (e publicar) toda vez que a igreja inventa um momento novo na
   * transmissão. A tela oferece SUGESTÕES de categoria, e agrupa pelo valor
   * que estiver gravado — quem digitar "Ofertas" duas vezes acaba com uma
   * pasta só, e quem quiser "Batismo" tem "Batismo" sem pedir nada a
   * ninguém.
   *
   * Vazio significa "Sem categoria" — a tela agrupa esses no fim.
   */
  categoria: string;
  /** Quantas vezes já foi copiada. Ordena a lista dentro de cada categoria. */
  vezesCopiada: number;
  criadaPor: string;
  criadaEm: string; // ISO 8601 em UTC
}

/** O que a tela envia ao cadastrar ou editar uma mensagem. */
export interface NovaMensagemDaLive {
  texto: string;
  categoria: string;
}

/** Rótulo das mensagens que ficaram sem categoria. */
export const SEM_CATEGORIA = 'Sem categoria';

/**
 * Sugestões que aparecem no campo de categoria quando a igreja ainda não
 * inventou as suas. São só um ponto de partida no `<datalist>` — nada aqui
 * restringe o que pode ser digitado.
 */
export const CATEGORIAS_SUGERIDAS = [
  'Abertura',
  'Boas-vindas',
  'Ofertas',
  'Oração',
  'Avisos',
  'Encerramento',
] as const;

/** Limite de texto. Chat de live não aceita parágrafo, e ninguém cola um. */
export const TAMANHO_MAXIMO_TEXTO = 500;

/** Categoria não pode virar um parágrafo — é rótulo de pasta, não texto. */
export const TAMANHO_MAXIMO_CATEGORIA = 40;

/**
 * Normaliza um documento vindo do Firestore.
 *
 * Documento antigo ou incompleto não pode derrubar a tela inteira — já
 * aconteceu neste projeto. Toda leitura passa por aqui e sai com todos os
 * campos preenchidos, mesmo que o documento no banco esteja pela metade.
 */
export function normalizarMensagemDaLive(
  bruto: Partial<MensagemDaLive> & { id: string },
): MensagemDaLive {
  const copias = Number(bruto.vezesCopiada);
  return {
    id: bruto.id,
    texto: typeof bruto.texto === 'string' ? bruto.texto : '',
    categoria: typeof bruto.categoria === 'string' ? bruto.categoria.trim() : '',
    vezesCopiada:
      Number.isFinite(copias) && copias > 0 ? Math.min(Math.floor(copias), MAXIMO_COPIAS) : 0,
    criadaPor: typeof bruto.criadaPor === 'string' ? bruto.criadaPor : '',
    criadaEm: typeof bruto.criadaEm === 'string' ? bruto.criadaEm : '',
  };
}

/** Uma categoria com as mensagens que caem nela. */
export interface GrupoDeCategoria {
  categoria: string;
  mensagens: MensagemDaLive[];
}

/**
 * Agrupa as mensagens por categoria, prontas para a tela desenhar.
 *
 * A ordem é pensada para quem está ao vivo, não para quem cadastrou:
 * dentro de cada categoria vem primeiro a mais usada (a de sempre costuma
 * ser a que se quer de novo), e as categorias vêm em ordem alfabética — que
 * é estável entre recarregamentos, ao contrário de "a mais usada primeiro",
 * que faria as pastas dançarem de lugar no meio da live.
 *
 * "Sem categoria" fica sempre por último: é o balaio do que ninguém
 * organizou, não merece o topo.
 */
export function agruparPorCategoria(mensagens: MensagemDaLive[]): GrupoDeCategoria[] {
  const pastas = new Map<string, MensagemDaLive[]>();

  for (const mensagem of mensagens) {
    const chave = mensagem.categoria || SEM_CATEGORIA;
    const lista = pastas.get(chave);
    if (lista) lista.push(mensagem);
    else pastas.set(chave, [mensagem]);
  }

  return [...pastas.entries()]
    .map(([categoria, lista]) => ({
      categoria,
      mensagens: [...lista].sort(
        (a, b) =>
          b.vezesCopiada - a.vezesCopiada || a.criadaEm.localeCompare(b.criadaEm),
      ),
    }))
    .sort((a, b) => {
      if (a.categoria === SEM_CATEGORIA) return 1;
      if (b.categoria === SEM_CATEGORIA) return -1;
      return a.categoria.localeCompare(b.categoria, 'pt-BR');
    });
}

/**
 * O que impede uma mensagem de ser salva, ou `null` se estiver tudo certo.
 * Mesma forma de `problemaNoNome` em `departamento-validacao.ts`: a rota e a
 * tela chamam a mesma função, então a regra não vive em dois lugares.
 */
export function problemaNaMensagem(texto: string): string | null {
  const limpo = texto.trim();
  if (!limpo) return 'Escreva o texto da mensagem.';
  if (limpo.length > TAMANHO_MAXIMO_TEXTO) {
    return `A mensagem passa de ${TAMANHO_MAXIMO_TEXTO} caracteres.`;
  }
  return null;
}

export interface StoreMensagensDaLive {
  listar(): Promise<MensagemDaLive[]>;
  criar(dados: NovaMensagemDaLive, autor: string): Promise<MensagemDaLive>;
  atualizar(id: string, dados: NovaMensagemDaLive): Promise<MensagemDaLive | null>;
  remover(id: string): Promise<void>;
  /** Soma uma cópia ao contador. Não falha se a mensagem já foi apagada. */
  registrarCopia(id: string): Promise<void>;
}

/**
 * Lê e valida o corpo JSON que `POST` e `PUT` das rotas compartilham.
 *
 * Fica aqui, e não num dos dois arquivos de rota, porque no App Router um
 * `route.ts` só pode exportar os verbos HTTP — exportar um ajudante dali
 * quebraria o build.
 */
export async function lerCorpoDaMensagem(
  request: Request,
): Promise<NovaMensagemDaLive | { erro: string }> {
  let corpo: { texto?: unknown; categoria?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return { erro: 'Envio inválido.' };
  }

  const texto = typeof corpo.texto === 'string' ? corpo.texto.trim() : '';
  const problema = problemaNaMensagem(texto);
  if (problema) return { erro: problema };

  const categoria = typeof corpo.categoria === 'string' ? corpo.categoria.trim() : '';
  if (categoria.length > TAMANHO_MAXIMO_CATEGORIA) {
    return { erro: `A categoria passa de ${TAMANHO_MAXIMO_CATEGORIA} caracteres.` };
  }

  return { texto, categoria };
}

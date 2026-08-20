/**
 * Configurações do Coredja que ficam guardadas no banco, e não em arquivo.
 *
 * Até aqui, endereço e token do Holyrics viviam só no `.env.local`. Isso
 * funciona para quem roda o projeto na própria máquina e tem o arquivo à
 * mão — mas publicado o Coredja passa a estar num servidor onde ninguém abre
 * editor de texto. Trocar um token que vazou, ou apontar para outro PC depois
 * de a igreja trocar o computador do audiovisual, exigiria acesso ao servidor
 * e um reinício.
 *
 * Então a configuração passa a ter DUAS camadas, nesta ordem de precedência:
 *
 *   1. O que estiver gravado no banco (editável pela tela de Configurações)
 *   2. O que estiver em `.env.local` (fallback)
 *
 * O arquivo continua valendo de propósito: é o que faz o projeto subir já
 * configurado numa instalação nova, sem ninguém precisar preencher a tela
 * antes do primeiro culto. E se um dia o banco ficar inacessível, o Holyrics
 * segue funcionando pelo arquivo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O TOKEN NUNCA VAI PARA O NAVEGADOR
 * ────────────────────────────────────────────────────────────────────────────
 * Este módulo é de servidor. A tela de Configurações recebe apenas um resumo
 * (`ConfiguracaoParaTela`), com o token mascarado. Quem quiser trocar o token
 * escreve um novo — não existe caminho de leitura do valor real pela API, nem
 * para admin. É a mesma escolha de `holyrics.ts`, onde a chamada sai do
 * servidor justamente para o token não passar pelo cliente.
 *
 * A coleção `configuracoes` também fica fechada nas `firestore.rules` para
 * leitura direta pelo navegador — diferente de `mensagens`/`avisos`/`culto`,
 * que são abertas para o tempo real. Ela cai no catch-all `allow read, write:
 * if false`, e é o único lugar do Coredja onde essa negação de LEITURA importa
 * de fato, e não só a de escrita.
 */

import { getFirestoreDb } from './firebase';

/** Documento único que guarda tudo — não há motivo para mais de um. */
const COLECAO = 'configuracoes';
const DOCUMENTO = 'geral';

/** O que fica guardado. Campos ausentes caem no `.env.local`. */
export interface ConfiguracoesGravadas {
  holyricsUrl?: string;
  holyricsToken?: string;
  /** ISO 8601 de quando alguém salvou pela última vez. */
  atualizadoEm?: string;
  /** Nome de quem salvou, para a tela dizer "alterado por Fulano". */
  atualizadoPor?: string;
}

/**
 * Cache em memória do processo.
 *
 * O Holyrics é chamado a cada avanço de bloco no domingo — sem cache, cada
 * clique custaria uma leitura extra no Firestore só para descobrir o token.
 * O cache é invalidado ao salvar (`salvarConfiguracoes`), então quem edita vê
 * o efeito na hora; num deploy com mais de uma instância, a outra instância
 * pega o valor novo quando o cache dela vencer.
 */
let cache: { valor: ConfiguracoesGravadas; expiraEm: number } | null = null;
const VALIDADE_DO_CACHE_MS = 60_000;

/**
 * Lê o que está gravado. Nunca lança: se o banco não responder, devolve vazio
 * e a configuração inteira cai no `.env.local`.
 *
 * Falhar em silêncio é a escolha certa aqui porque este caminho é chamado no
 * meio do culto (avançar bloco → mandar cronômetro ao Holyrics). Uma exceção
 * aqui derrubaria o avanço do bloco por causa da configuração, que é o
 * acessório.
 */
export async function lerConfiguracoesGravadas(): Promise<ConfiguracoesGravadas> {
  const agora = Date.now();
  if (cache && cache.expiraEm > agora) return cache.valor;

  let valor: ConfiguracoesGravadas = {};
  try {
    const doc = await getFirestoreDb().collection(COLECAO).doc(DOCUMENTO).get();
    if (doc.exists) valor = (doc.data() ?? {}) as ConfiguracoesGravadas;
  } catch {
    // Banco fora do ar, credencial ausente, ou COREDJA_STORAGE=sqlite sem
    // Firebase configurado. Em todos os casos: segue com o `.env.local`.
  }

  cache = { valor, expiraEm: agora + VALIDADE_DO_CACHE_MS };
  return valor;
}

/**
 * Grava a configuração. Só campos presentes em `mudancas` são tocados —
 * salvar o endereço sem mexer no token é o caso comum, e mandar o token
 * mascarado de volta o apagaria.
 *
 * String vazia é intencional e significa "limpar": é assim que se desliga a
 * integração pela tela sem precisar do arquivo.
 */
export async function salvarConfiguracoes(
  mudancas: Partial<Pick<ConfiguracoesGravadas, 'holyricsUrl' | 'holyricsToken'>>,
  quem: string,
): Promise<void> {
  const dados: ConfiguracoesGravadas = {
    ...mudancas,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: quem,
  };

  await getFirestoreDb()
    .collection(COLECAO)
    .doc(DOCUMENTO)
    .set(dados, { merge: true });

  // Invalida na hora: quem acabou de salvar precisa ver o efeito no "Testar
  // conexão" logo em seguida, não daqui a um minuto.
  cache = null;
}

/** Descarta o cache. Existe para os testes e para forçar releitura. */
export function esquecerCacheDeConfiguracoes(): void {
  cache = null;
}

/** De onde veio o valor que está valendo — a tela mostra isso ao lado do campo. */
export type OrigemDoValor = 'banco' | 'arquivo' | 'ausente';

/**
 * Resolve um valor entre banco e arquivo, dizendo de onde ele veio.
 *
 * A origem não é detalhe: sem ela, alguém que editou o `.env.local` e não viu
 * efeito nenhum não teria como descobrir que existe um valor no banco
 * ganhando dele. Mostrar "vindo do arquivo" / "vindo desta tela" transforma
 * uma hora de confusão numa olhada.
 */
export function resolver(
  doBanco: string | undefined,
  doArquivo: string | undefined,
): { valor: string; origem: OrigemDoValor } {
  const banco = (doBanco ?? '').trim();
  if (banco) return { valor: banco, origem: 'banco' };

  const arquivo = (doArquivo ?? '').trim();
  if (arquivo) return { valor: arquivo, origem: 'arquivo' };

  return { valor: '', origem: 'ausente' };
}

/**
 * Mascara um segredo para exibição: mantém os 4 últimos caracteres e troca o
 * resto por pontos.
 *
 * Os 4 finais existem para dar conferência — quem tem o token à mão consegue
 * dizer "é esse mesmo" sem que a tela o entregue. Segredo curto demais some
 * inteiro, senão a máscara revelaria quase tudo.
 */
export function mascarar(segredo: string): string {
  const limpo = segredo.trim();
  if (!limpo) return '';
  if (limpo.length <= 6) return '••••••';
  return `${'•'.repeat(8)}${limpo.slice(-4)}`;
}

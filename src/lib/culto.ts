/**
 * Contrato de dados da Ordem do Culto.
 *
 * A primeira versão guardava UM documento só (id fixo `atual`): montar o culto
 * novo apagava o anterior. Isso deixou de servir quando apareceu a necessidade
 * real de preparar mais de um culto de uma vez — o domingo, a quarta, o
 * domingo seguinte — cada um com sua data, sem que salvar um destruísse o
 * outro. Essa segunda versão guardava uma ordem por DATA (`"2026-08-24"`).
 *
 * Agora existe uma terceira necessidade: mais de uma ordem no MESMO dia (culto
 * de manhã e de noite). O id deixou de poder ser só a data — duas ordens no
 * mesmo domingo colidiriam. O esquema atual é `id = "{data}__{hora}"`
 * (`"2026-08-24__09:00"`), que:
 *
 * - Preserva ordenação lexicográfica natural: data e hora ordenam certo como
 *   string, então ordenar por id continua sendo ordenar por quando acontece.
 * - Continua determinístico: duas ordens salvas para a mesma data+hora
 *   sobrescrevem uma a outra — é a mesma ordem sendo corrigida, mesma regra
 *   que "mesma data" tinha antes, generalizada para incluir a hora.
 *
 * Qual ordem "vale" agora não é marcado por ninguém — é derivado da data+hora
 * mais próxima de agora, entre as de hoje (ver `buscarAtiva`), descontadas as
 * concluídas manualmente. Ninguém precisa lembrar de publicar ou despublicar
 * nada; o relógio decide — exceto quando alguém marca "Concluir" para tirar
 * uma ordem do posto antes da hora (culto que terminou mais cedo, por
 * exemplo), o que `concluidoEm` existe para registrar.
 */

export type IdBloco = string;

/** Um bloco da sequência do culto (ex: "Louvor", "Palavra"). */
export interface Bloco {
  id: IdBloco;
  titulo: string;
  /** Minutos previstos. Só orientativo — nada impede passar do tempo. */
  minutos: number;
  /**
   * Quem conduz este bloco ("Pr. Daniel", "Ana + banda", "Telão · Priscila").
   *
   * Texto livre, e não um id de pessoa cadastrada, de propósito: metade dos
   * responsáveis reais não tem (nem vai ter) login no Coredja — banda,
   * visitante, "quem estiver na escala". Um seletor de pessoas obrigaria a
   * cadastrar gente só para escrever um nome numa linha.
   *
   * Opcional: ordem gravada antes deste campo existir não tem o valor, e a
   * tela precisa continuar abrindo. Ver `responsavelDoBloco`.
   */
  responsavel?: string;
}

/** Uma ordem de culto: a sequência montada e qual bloco está em andamento. */
export interface Culto {
  /** `"{data}__{hora}"` — o id do documento no Firestore. Ver nota no topo. */
  id: string;
  data: string; // ISO 8601, só a data (ex: "2026-08-24")
  hora: string; // "HH:MM", 24h (ex: "09:00")
  blocos: Bloco[];
  /** id do bloco em andamento. null antes de começar, ou após o último. */
  blocoAtualId: IdBloco | null;
  /**
   * Quando esta ordem foi marcada "concluída" manualmente. null enquanto
   * aberta. Independente de `blocoAtualId`: dá para concluir sem ter avançado
   * por todos os blocos (culto que encurtou), e o avanço automático pelos
   * blocos não conclui sozinho — só o clique explícito faz.
   */
  concluidoEm: string | null;
  /**
   * `"pronta"` (padrão) ou `"rascunho"`.
   *
   * Rascunho é uma ordem ainda sendo montada — pode estar com blocos pela
   * metade, sem responsáveis, com tempo chutado. A regra que isso governa é
   * uma só, e está em `buscarAtiva`/`ativaEntre`: **rascunho nunca vira a
   * ordem ativa sozinha**. Sem isso, salvar um esboço do culto de quarta no
   * meio da semana faria ele roubar o posto de "no ar agora" do domingo.
   *
   * Não é uma trava de permissão nem de execução: quem abrir um rascunho
   * pela lista continua podendo operá-lo normalmente (um ensaio, um teste).
   * A diferença é só entre "o relógio escolhe" e "uma pessoa escolheu".
   *
   * Opcional na leitura porque documento antigo não tem o campo — a ausência
   * é lida como `"pronta"`, que é como essas ordens se comportavam antes de
   * o campo existir (ver `statusDoCulto`). Nada de script de migração.
   */
  status?: StatusCulto;
  /**
   * Quando o bloco atual COMEÇOU (ISO 8601 em UTC). É o que permite o
   * cronômetro da tela sobreviver a um F5 ou a abrir em outro aparelho: sem
   * isso o tempo restante só existiria na memória da aba, e recarregar
   * reiniciaria a contagem do zero no meio da pregação.
   *
   * Gravado por quem muda o bloco (`avancar`, `definirBlocoAtual`), não por
   * quem lê. `null` quando o culto não começou ou já encerrou.
   */
  blocoIniciadoEm?: string | null;
  /**
   * Quando alguém pausou (ISO 8601 em UTC), ou `null` se está correndo.
   *
   * Mora no documento, e não no estado da aba, porque a pausa precisa valer
   * entre aparelhos: quem pausou pelo celular no palco e quem olha o telão
   * da mesa de som têm que ver o MESMO relógio parado. Ver
   * `restanteDoBloco`, que trata pausa como "congela o relógio".
   */
  pausadoEm?: string | null;
  /**
   * Segundos já acumulados no bloco atual ANTES da pausa vigente. Só faz
   * sentido junto de `pausadoEm`/`blocoIniciadoEm`.
   *
   * Existe porque pausar-e-retomar não pode ser feito só movendo
   * `blocoIniciadoEm` para frente: entre a pausa e o retomar ninguém sabe
   * quanto tempo vai passar, então o valor certo só é conhecido no momento
   * de retomar. Guardar o acumulado deixa a conta trivial nos dois estados —
   * correndo: `acumulado + (agora - inicio)`; pausado: `acumulado` puro.
   */
  segundosAcumulados?: number;
  /**
   * Minutos extras dados ao bloco atual pelo "+1/+5 min", que NÃO reescrevem
   * `bloco.minutos`.
   *
   * A separação é a mesma que `api/culto/tempo-extra` já defendia: os
   * minutos do bloco são o PLANEJADO, montado na semana, e um ajuste de
   * palco não deve reescrever o plano. A diferença é que agora o cronômetro
   * também vive na tela do Coredja (não só no Holyrics), então o extra
   * precisa estar em algum lugar que a tela leia — e num lugar que zere
   * sozinho ao trocar de bloco, que é o que acontece aqui.
   */
  minutosExtras?: number;
  /** Quem montou por último, para a tela mostrar "editado por fulano". */
  editadoPor: string;
  editadoEm: string; // ISO 8601 em UTC
}

/** Ver `Culto.status`. */
export type StatusCulto = 'pronta' | 'rascunho';

/** O que a tela de montagem envia ao salvar. */
export interface NovoCulto {
  data: string;
  hora: string;
  blocos: Bloco[];
  /** Ausente = `"pronta"`, o padrão histórico. Ver `Culto.status`. */
  status?: StatusCulto;
}

/**
 * Um modelo salvo: só a sequência de blocos, sem data/hora/estado — reutilizável
 * ao montar uma ordem nova. Coleção separada (`culto_modelos`) porque são
 * poucos, pequenos, e não têm nada a ver com "quando" um culto acontece.
 */
export interface ModeloCulto {
  id: string;
  nome: string;
  blocos: Bloco[];
  criadoPor: string;
  criadoEm: string; // ISO 8601 em UTC
}

export interface NovoModelo {
  nome: string;
  blocos: Bloco[];
}

/**
 * A data de hoje no fuso de quem roda o servidor, como `"YYYY-MM-DD"`.
 *
 * Não dá para usar `toISOString().slice(0, 10)`: aquilo devolve a data em UTC,
 * que à noite no Brasil já é o dia seguinte — a ordem de hoje sumiria da tela
 * de execução antes do culto acabar.
 */
export function hojeLocal(agora: Date = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/** `"HH:MM"` agora, no fuso de quem roda o servidor. */
export function horaLocal(agora: Date = new Date()): string {
  const horas = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

/** Monta o id determinístico de uma ordem a partir de data+hora. */
export function idDoCulto(data: string, hora: string): string {
  return `${data}__${hora}`;
}

export interface StoreCulto {
  /** Todas as ordens, da mais antiga para a mais nova (data, depois hora). */
  listar(): Promise<Culto[]>;
  buscar(id: string): Promise<Culto | null>;
  /**
   * A ordem que vale agora: entre as de hoje que ainda não foram concluídas,
   * a de horário mais próximo do agora (passado ou futuro); se não houver
   * nenhuma hoje, a próxima futura mais próxima. null se só existem ordens
   * passadas, todas as de hoje já concluídas, ou nenhuma ordem.
   */
  buscarAtiva(): Promise<Culto | null>;
  /** Cria ou sobrescreve a ordem daquela data+hora. */
  salvar(dados: NovoCulto, autor: string): Promise<Culto>;
  remover(id: string): Promise<void>;
  /** Avança para o próximo bloco, ou o primeiro, se ainda não começou. */
  avancar(id: string): Promise<Culto | null>;
  /**
   * Põe o culto direto num bloco escolhido, sem passar pelos do meio — serve
   * para pular adiante e para voltar quando alguém avançou sem querer.
   * Devolve `null` se a ordem não existe ou se o bloco não é dela.
   */
  definirBlocoAtual(id: string, blocoId: IdBloco): Promise<Culto | null>;
  /** Volta para null — o culto para de estar "em andamento". */
  reiniciar(id: string): Promise<Culto | null>;
  /** Marca/desmarca `concluidoEm`. `concluir(id, false)` reabre. */
  concluir(id: string, concluir: boolean): Promise<Culto | null>;
  /**
   * Pausa ou retoma o cronômetro do bloco em andamento. Devolve `null` se a
   * ordem não existe. Pausar o que já está pausado (ou retomar o que já
   * corre) é sem efeito, não erro: dois aparelhos podem clicar junto.
   */
  pausar(id: string, pausar: boolean): Promise<Culto | null>;
  /**
   * Soma minutos ao bloco em andamento SEM reescrever `bloco.minutos`.
   * Ver `Culto.minutosExtras`.
   */
  darTempoExtra(id: string, minutos: number): Promise<Culto | null>;

  listarModelos(): Promise<ModeloCulto[]>;
  salvarModelo(dados: NovoModelo, autor: string): Promise<ModeloCulto>;
  removerModelo(id: string): Promise<void>;
}


/* ────────────────────────────────────────────────────────────────────────────
 * Derivações — nada aqui é campo gravado.
 *
 * Horário de cada bloco, término previsto, atraso e tempo restante são todos
 * CALCULADOS a partir de três coisas que já existem: a hora de início da
 * ordem, a duração de cada bloco, e (para o cronômetro) `blocoIniciadoEm`.
 * Gravar qualquer um deles criaria uma segunda verdade que precisaria ser
 * mantida em sincronia com a primeira a cada edição de bloco — e que
 * silenciosamente ficaria errada assim que alguém mudasse um tempo.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Minutos desde a meia-noite de um `"HH:MM"`. */
export function minutosDoHorario(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/**
 * `"HH:MM"` a partir de minutos desde a meia-noite. Passa da meia-noite sem
 * quebrar (culto de virada de ano): 25h vira 01:00, não 25:00.
 */
export function horarioDeMinutos(total: number): string {
  const normalizado = ((Math.round(total) % 1440) + 1440) % 1440;
  const h = String(Math.floor(normalizado / 60)).padStart(2, '0');
  const m = String(normalizado % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** Minutos previstos de um bloco, tolerando valor ausente ou inválido. */
export function minutosDoBloco(bloco: Pick<Bloco, 'minutos'>): number {
  const n = Number(bloco.minutos);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Soma dos minutos previstos de todos os blocos. */
export function totalDeMinutos(blocos: Pick<Bloco, 'minutos'>[]): number {
  return blocos.reduce((soma, b) => soma + minutosDoBloco(b), 0);
}

/**
 * O horário em que cada bloco COMEÇA, na ordem — `["09:00", "09:05", ...]`.
 * É a hora da ordem mais a soma das durações dos blocos anteriores.
 */
export function horariosDosBlocos(culto: Pick<Culto, 'hora' | 'blocos'>): string[] {
  const inicio = minutosDoHorario(culto.hora);
  let acumulado = 0;
  return culto.blocos.map((bloco) => {
    const horario = horarioDeMinutos(inicio + acumulado);
    acumulado += minutosDoBloco(bloco);
    return horario;
  });
}

/** `"10:20"` — quando o culto acaba, se tudo correr no tempo previsto. */
export function terminoPrevisto(culto: Pick<Culto, 'hora' | 'blocos'>): string {
  return horarioDeMinutos(minutosDoHorario(culto.hora) + totalDeMinutos(culto.blocos));
}

/** Ver `Culto.status`: ausência do campo é `"pronta"`, o padrão histórico. */
export function statusDoCulto(culto: Pick<Culto, 'status'>): StatusCulto {
  return culto.status === 'rascunho' ? 'rascunho' : 'pronta';
}

/** Ver `Bloco.responsavel`: string vazia e ausência são a mesma coisa. */
export function responsavelDoBloco(bloco: Pick<Bloco, 'responsavel'>): string | null {
  const nome = bloco.responsavel?.trim();
  return nome ? nome : null;
}

/** Índice do bloco em andamento, ou -1 (não começou, ou já encerrou). */
export function indiceDoBlocoAtual(
  culto: Pick<Culto, 'blocos' | 'blocoAtualId'>,
): number {
  if (!culto.blocoAtualId) return -1;
  return culto.blocos.findIndex((b) => b.id === culto.blocoAtualId);
}

/** Duração do bloco atual em segundos, já somados os "+1/+5 min" dados a ele. */
export function duracaoDoBlocoAtualEmSegundos(culto: Culto): number {
  const indice = indiceDoBlocoAtual(culto);
  if (indice === -1) return 0;
  const extras = Number(culto.minutosExtras);
  const somados = Number.isFinite(extras) && extras > 0 ? extras : 0;
  return (minutosDoBloco(culto.blocos[indice]) + somados) * 60;
}

/**
 * Quantos segundos o bloco atual já correu, em `agora`.
 *
 * Pausado, o relógio congela no acumulado; correndo, é o acumulado mais o
 * tempo desde `blocoIniciadoEm`. Sem `blocoIniciadoEm` (ordem gravada antes
 * do campo existir, ou culto que ninguém começou) devolve o acumulado, que
 * nesses casos é zero — a tela mostra o bloco inteiro por correr, em vez de
 * um número inventado.
 */
export function decorridoDoBlocoEmSegundos(
  culto: Culto,
  agora: Date = new Date(),
): number {
  const acumulado = Number(culto.segundosAcumulados);
  const base = Number.isFinite(acumulado) && acumulado > 0 ? acumulado : 0;

  if (culto.pausadoEm) return base;
  if (!culto.blocoIniciadoEm) return base;

  const inicio = Date.parse(culto.blocoIniciadoEm);
  if (!Number.isFinite(inicio)) return base;

  return base + Math.max(0, Math.floor((agora.getTime() - inicio) / 1000));
}

/**
 * Quanto FALTA do bloco atual, em segundos. Negativo quando estourou o
 * tempo — que é informação, não erro: quem está no palco precisa ver o
 * quanto passou, mesma razão do `stop_at_zero: false` do Holyrics.
 */
export function restanteDoBloco(culto: Culto, agora: Date = new Date()): number {
  return duracaoDoBlocoAtualEmSegundos(culto) - decorridoDoBlocoEmSegundos(culto, agora);
}

/** `"13:15"` a partir de segundos. Sempre positivo — o sinal fica com quem chama. */
export function formatarCronometro(segundos: number): string {
  const s = Math.abs(Math.round(segundos));
  const minutos = String(Math.floor(s / 60)).padStart(2, '0');
  return `${minutos}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * O quanto o culto está atrasado, em MINUTOS (negativo = adiantado).
 *
 * Compara o horário previsto do bloco atual com o relógio de verdade: se o
 * bloco 2 deveria ter começado 09:05 e são 09:07, o culto está 2 minutos
 * atrasado. Continua valendo enquanto o bloco corre — o número só muda
 * quando alguém avança (o bloco seguinte tem outro horário previsto).
 *
 * `null` quando não há bloco em andamento: sem bloco atual não há previsto
 * com o que comparar, e mostrar "0 min" ali seria afirmar algo que ninguém
 * verificou.
 */
export function atrasoEmMinutos(culto: Culto, agora: Date = new Date()): number | null {
  const indice = indiceDoBlocoAtual(culto);
  if (indice === -1) return null;

  // Só faz sentido comparar com o relógio no DIA da ordem. Um culto de
  // domingo aberto na terça para conferência mostraria "343 min atrasado"
  // (a diferença entre 09:00 e a hora em que a pessoa abriu), um número que
  // não descreve nada — o culto não está atrasado, ele nem está acontecendo.
  if (hojeLocal(agora) !== culto.data) return null;

  const previsto = minutosDoHorario(horariosDosBlocos(culto)[indice]);
  const real = agora.getHours() * 60 + agora.getMinutes();
  return real - previsto;
}

/**
 * Percentual do culto já cumprido (0 a 100), contando os blocos concluídos
 * mais a fatia já corrida do bloco atual.
 */
export function percentualDoCulto(culto: Culto, agora: Date = new Date()): number {
  const total = totalDeMinutos(culto.blocos);
  if (total === 0) return 0;

  const indice = indiceDoBlocoAtual(culto);
  if (indice === -1) {
    // Sem bloco atual: ou não começou (0%) ou passou do último (100%).
    return culto.blocoAtualId === null ? 0 : 100;
  }

  const anteriores = culto.blocos
    .slice(0, indice)
    .reduce((soma, b) => soma + minutosDoBloco(b), 0);
  const duracao = duracaoDoBlocoAtualEmSegundos(culto);
  const corrido = Math.min(decorridoDoBlocoEmSegundos(culto, agora), duracao) / 60;

  return Math.min(100, Math.round(((anteriores + corrido) / total) * 100));
}

/**
 * Percentual do BLOCO atual já corrido (0 a 100), para a barra fina embaixo
 * do cronômetro. Trava em 100 quando estoura: a barra cheia já diz "acabou",
 * e o quanto passou é o cronômetro que conta.
 */
export function percentualDoBloco(culto: Culto, agora: Date = new Date()): number {
  const duracao = duracaoDoBlocoAtualEmSegundos(culto);
  if (duracao <= 0) return 0;
  return Math.min(100, (decorridoDoBlocoEmSegundos(culto, agora) / duracao) * 100);
}

/**
 * A "equipe de hoje" da barra lateral, derivada dos RESPONSÁVEIS dos blocos
 * da ordem — sem cadastro novo.
 *
 * A tela de referência mostra "Som / Telão / Louvor → nome". Criar um
 * cadastro de equipe só para isso duplicaria informação que já é digitada no
 * editor ("Telão · Priscila", "Ana + banda"), e abriria espaço para as duas
 * divergirem. Então a função lê os responsáveis e casa cada um com uma
 * função conhecida por palavra-chave, procurando no texto do responsável OU
 * no título do bloco; o que não casa com nada entra pelo próprio nome do
 * bloco, para a lista nunca vir vazia numa ordem que tem responsáveis
 * preenchidos.
 *
 * É deliberadamente aproximado: o custo de errar é um rótulo trocado numa
 * caixa informativa, e o ganho é não ter mais uma tela de cadastro para
 * alguém manter atualizada toda semana.
 */
export function equipeDoCulto(
  culto: Pick<Culto, 'blocos'> | null,
): { funcao: string; nome: string }[] {
  if (!culto) return [];

  const PALAVRAS: { funcao: string; termos: string[] }[] = [
    { funcao: 'Som', termos: ['som', 'áudio', 'audio', 'mesa'] },
    { funcao: 'Telão', termos: ['telão', 'telao', 'projeção', 'projecao', 'slide'] },
    {
      funcao: 'Louvor',
      termos: ['louvor', 'banda', 'ministração', 'ministracao', 'canção', 'cancao'],
    },
  ];

  const encontrados = new Map<string, string>();
  const sobras: { funcao: string; nome: string }[] = [];

  for (const bloco of culto.blocos) {
    const nome = responsavelDoBloco(bloco);
    if (!nome) continue;

    const texto = `${bloco.titulo} ${nome}`.toLowerCase();
    const casou = PALAVRAS.find((p) => p.termos.some((t) => texto.includes(t)));

    if (casou) {
      // Primeiro bloco que casa com a função é quem fica: a ordem é
      // cronológica, então o primeiro é quem assume desde o começo.
      if (!encontrados.has(casou.funcao)) encontrados.set(casou.funcao, nome);
    } else {
      sobras.push({ funcao: bloco.titulo || 'Bloco', nome });
    }
  }

  const conhecidos = PALAVRAS.filter((p) => encontrados.has(p.funcao)).map((p) => ({
    funcao: p.funcao,
    nome: encontrados.get(p.funcao) as string,
  }));

  // Teto de 5 linhas: a caixa mora no rodapé da barra lateral, e uma lista
  // longa empurraria o menu para fora da tela em notebook baixo.
  return [...conhecidos, ...sobras].slice(0, 5);
}

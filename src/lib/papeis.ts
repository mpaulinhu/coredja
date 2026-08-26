/**
 * Papéis de quem acessa o Coredja publicado.
 *
 * Local, o link secreto de cada área bastava — só quem estava na Wi-Fi da
 * igreja alcançava. Publicado, qualquer pessoa na internet alcança, e o
 * Coredja passa a ter dois tipos de gente diferentes:
 *
 * - As ÁREAS (Cantina, Kids) continuam entrando pelo link com token, sem
 *   login. Elas só mandam recado — não ganham conta, não precisam de senha.
 *   Ver `areas.ts`.
 *
 * - As PESSOAS da igreja entram com e-mail e senha (Firebase Authentication)
 *   para usar as telas internas: montar a ordem do culto, cadastrar avisos,
 *   escalar o time, operar o painel no domingo. É a essas pessoas que este
 *   arquivo se refere.
 *
 * O papel de cada pessoa fica na coleção `pessoas` do Firestore, indexada
 * pelo UID que o Firebase Authentication atribui. Criar uma conta de login
 * NÃO dá acesso a nada por si só — dá acesso o documento em `pessoas` que
 * alguém com papel Líder criar apontando para aquele UID.
 */

/**
 * Os cargos do Coredja publicado, do mais para o menos amplo. É uma
 * hierarquia de cargo único (como `datametria_super_admin > ... > viewer` do
 * CoreHub): cada pessoa tem UM cargo, e ele já inclui tudo que os cargos
 * abaixo dele fazem — não precisa marcar vários.
 *
 * - `admin`: gerencia quem tem conta e o que cada pessoa pode ver, mais tudo
 *   que Líder e Operador fazem.
 * - `lider`: monta a ordem do culto e os avisos, mais tudo que o Operador faz.
 * - `operador`: executa no domingo — avança a ordem, publica o aviso no
 *   telão, usa as mensagens da transmissão. Não edita o que foi preparado
 *   na semana.
 * - `area`: não é um cargo de pessoa — existe aqui só para o código que
 *   confere permissão poder tratar link-de-área e login-de-pessoa de forma
 *   parecida quando fizer sentido. Fica fora da hierarquia numérica abaixo.
 *
 * Havia um quarto cargo, `coordenador`, entre Líder e Operador. Ele existia
 * para a Escala do Time — que saiu do menu quando a igreja passou a usar o
 * Voluts (19/08/2026) — e ficou carregando só a permissão das mensagens da
 * transmissão, que agora é do Operador. Um cargo a menos é um a menos para
 * explicar a quem cadastra gente (26/08/2026).
 */
export type Papel = 'admin' | 'lider' | 'operador' | 'area';

/**
 * Nível numérico de cada cargo de pessoa — quanto menor, mais amplo. Não
 * inclui `area`, que não é um cargo hierárquico.
 */
export const NIVEL_PAPEL: Record<Exclude<Papel, 'area'>, number> = {
  admin: 0,
  lider: 1,
  operador: 2,
};

/**
 * Uma pessoa com login no Coredja.
 *
 * `departamento` e `areasVisiveis` convivem como campos distintos e cobrem
 * coisas diferentes:
 *
 * - `departamento` é o pertencimento — de qual departamento a pessoa fala
 *   quando escreve no Painel (ver `remetente` em `types.ts`). Seleção única.
 * - `areasVisiveis` é COM QUEM ela pode conversar: os departamentos com quem
 *   o admin liberou abrir conversa. Cantina com `['audiovisual','kids']` tem
 *   duas conversas — Cantina ↔ Audiovisual e Cantina ↔ Kids — e em ambas ela
 *   escreve assinando "Cantina". Não dá acesso a conversas de terceiros: a
 *   conversa Kids ↔ Audiovisual não é dela e não aparece.
 *
 * Vazio ou ausente significa que ela ainda não pode falar com ninguém, não
 * "pode falar com todos": é mais seguro que uma pessoa nova comece sem
 * alcance e o admin libere explicitamente.
 */
export interface Pessoa {
  /** UID do Firebase Authentication — é também o id do documento. */
  uid: string;
  nome: string;
  email: string;
  papel: Papel;
  /** Slug do departamento (ver `types.ts`) a que esta pessoa pertence. */
  departamento?: string;
  /** Slugs dos departamentos com quem esta pessoa pode abrir conversa. */
  areasVisiveis?: string[];
  /**
   * Quais telas aparecem no menu desta pessoa (ver `ABAS`).
   *
   * Ausente = o padrão do cargo dela (`abasPadrao`). É o que faz toda conta
   * criada antes deste campo existir continuar funcionando, e é também o que
   * se quer na maioria dos casos: o admin só mexe aqui quando alguém foge da
   * regra — o operador que também organiza os avisos, o líder que não deve
   * ver Configurações.
   *
   * Esconder aba NÃO é permissão: a trava de verdade continua em cada rota
   * do servidor, que confere o papel a cada requisição. Isto é sobre não
   * poluir o menu de quem nunca vai usar aquela tela.
   */
  abas?: string[];
}

/** Uma tela do menu que pode ser ligada/desligada por pessoa. */
export interface Aba {
  /** Id estável, gravado no documento da pessoa. Casa com a rota. */
  id: string;
  rotulo: string;
  /** Cargo mínimo que costuma usar esta tela — vira o padrão em `abasPadrao`. */
  padraoAPartirDe: Exclude<Papel, 'area'>;
}

/**
 * As telas que o admin pode ligar ou desligar por pessoa.
 *
 * A ordem é a mesma do menu, para a lista de caixinhas na tela de Usuários
 * bater com o que a pessoa vai ver.
 */
export const ABAS: readonly Aba[] = [
  { id: 'painel', rotulo: 'Recados', padraoAPartirDe: 'operador' },
  { id: 'culto', rotulo: 'Ordem do Culto', padraoAPartirDe: 'operador' },
  { id: 'avisos', rotulo: 'Avisos do Telão', padraoAPartirDe: 'operador' },
  { id: 'ao-vivo', rotulo: 'Ao Vivo', padraoAPartirDe: 'operador' },
  { id: 'usuarios', rotulo: 'Usuários', padraoAPartirDe: 'admin' },
  { id: 'departamentos', rotulo: 'Departamentos', padraoAPartirDe: 'admin' },
  { id: 'configuracoes', rotulo: 'Configurações', padraoAPartirDe: 'admin' },
];

/** As abas que um cargo vê quando ninguém escolheu nada para a pessoa. */
export function abasPadrao(papel: Papel): string[] {
  if (papel === 'area') return [];
  return ABAS.filter((aba) => NIVEL_PAPEL[papel] <= NIVEL_PAPEL[aba.padraoAPartirDe]).map(
    (aba) => aba.id,
  );
}

/**
 * As abas que esta pessoa vê no menu.
 *
 * Uma aba escolhida à mão nunca ultrapassa o que o cargo alcança: marcar
 * "Usuários" para um operador não lhe daria a tela (o servidor recusaria de
 * qualquer forma), só um item de menu que leva a um erro. Filtrar aqui evita
 * prometer na navegação o que a permissão nega.
 */
export function abasDaPessoa(pessoa: Pick<Pessoa, 'papel' | 'abas'>): string[] {
  const permitidas = abasPadrao(pessoa.papel);
  if (!pessoa.abas) return permitidas;
  return pessoa.abas.filter((id) => permitidas.includes(id));
}

/**
 * Com quais departamentos esta pessoa pode conversar — os que o admin liberou
 * na tela de Usuários.
 *
 * `todos` é a lista de departamentos existentes: admin fala com qualquer um
 * sem precisar de liberação explícita, já que é ele quem administra o alcance
 * dos outros.
 */
export function podeConversarCom(pessoa: Pessoa, todos: string[]): string[] {
  const liberados = pessoa.papel === 'admin' ? todos : (pessoa.areasVisiveis ?? []);
  return liberados.filter((slug) => slug !== pessoa.departamento);
}

/** O que cada cargo ganha por si só, antes de herdar dos cargos abaixo. */
const PERMISSOES_PROPRIAS: Record<Exclude<Papel, 'area'>, readonly string[]> = {
  // 'departamentos:escrever' é exclusiva de admin — mesmo padrão de
  // 'pessoas:escrever': não herda para os demais cargos.
  admin: ['pessoas:escrever', 'departamentos:escrever'],
  lider: ['culto:escrever', 'avisos:escrever'],
  // `live:escrever` e `escala:escrever` eram do coordenador, que deixou de
  // existir. Foram para o operador de propósito: quem mantém a biblioteca de
  // mensagens da transmissão é o time técnico, que é justamente quem opera no
  // domingo — não quem prepara o culto na semana.
  operador: [
    'culto:avancar',
    'avisos:publicar',
    'escala:presenca',
    'escala:escrever',
    'live:escrever',
  ],
};

/** Permissões efetivas de cada cargo, já com a herança dos cargos abaixo somada. */
const CARGOS = Object.keys(NIVEL_PAPEL) as Exclude<Papel, 'area'>[];
function permissoesHerdadas(papel: Exclude<Papel, 'area'>): readonly string[] {
  return CARGOS.filter((outro) => NIVEL_PAPEL[outro] >= NIVEL_PAPEL[papel]).flatMap(
    (outro) => PERMISSOES_PROPRIAS[outro],
  );
}
const PERMISSOES: Record<Papel, readonly string[]> = {
  admin: permissoesHerdadas('admin'),
  lider: permissoesHerdadas('lider'),
  operador: permissoesHerdadas('operador'),
  area: [],
};

/** Se o cargo da pessoa (ou algum cargo que ele herda) tem permissão para a ação. */
export function podeFazer(papel: Papel, acao: string): boolean {
  return PERMISSOES[papel]?.includes(acao) ?? false;
}

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
 *   que Líder, Coordenador e Operador fazem.
 * - `lider`: monta a ordem do culto e os avisos, mais tudo que Coordenador e
 *   Operador fazem.
 * - `coordenador`: monta a escala do time, mais tudo que Operador faz.
 * - `operador`: só executa no domingo — avança a ordem, publica o aviso no
 *   telão, marca presença. Não edita o que foi preparado na semana.
 * - `area`: não é um cargo de pessoa — existe aqui só para o código que
 *   confere permissão poder tratar link-de-área e login-de-pessoa de forma
 *   parecida quando fizer sentido. Fica fora da hierarquia numérica abaixo.
 */
export type Papel = 'admin' | 'lider' | 'coordenador' | 'operador' | 'area';

/**
 * Nível numérico de cada cargo de pessoa — quanto menor, mais amplo. Não
 * inclui `area`, que não é um cargo hierárquico.
 */
export const NIVEL_PAPEL: Record<Exclude<Papel, 'area'>, number> = {
  admin: 0,
  lider: 1,
  coordenador: 2,
  operador: 3,
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
  // 'live:escrever' fica no coordenador, e não no lider como
  // 'avisos:escrever': quem mantém a biblioteca de mensagens da transmissão
  // é o time técnico (audiovisual), não quem prepara o culto. Operador
  // continua de fora — ele COPIA sem permissão nenhuma (copiar é leitura,
  // ver `GET /api/live/mensagens`) e escreve na hora pelo campo avulso da
  // tela, que não grava nada.
  coordenador: ['escala:escrever', 'live:escrever'],
  operador: ['culto:avancar', 'avisos:publicar', 'escala:presenca'],
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
  coordenador: permissoesHerdadas('coordenador'),
  operador: permissoesHerdadas('operador'),
  area: [],
};

/** Se o cargo da pessoa (ou algum cargo que ele herda) tem permissão para a ação. */
export function podeFazer(papel: Papel, acao: string): boolean {
  return PERMISSOES[papel]?.includes(acao) ?? false;
}

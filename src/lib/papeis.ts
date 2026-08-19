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
 * Os quatro papéis do Coredja publicado, do mais para o menos amplo.
 *
 * - `lider`: monta a ordem do culto e os avisos, cadastra outras pessoas.
 * - `coordenador`: monta a escala do time.
 * - `operador`: só executa no domingo — avança a ordem, publica o aviso no
 *   telão, marca presença. Não edita o que foi preparado na semana.
 * - `area`: não é bem um papel de pessoa — existe aqui só para o código que
 *   confere permissão poder tratar link-de-área e login-de-pessoa de forma
 *   parecida quando fizer sentido. A maioria das checagens não vai usar isto.
 */
export type Papel = 'lider' | 'coordenador' | 'operador' | 'area';

/** Uma pessoa com login no Coredja. */
export interface Pessoa {
  /** UID do Firebase Authentication — é também o id do documento. */
  uid: string;
  nome: string;
  email: string;
  papel: Papel;
}

/**
 * O que cada papel pode fazer, numa tabela — em vez de `if papel === ...`
 * espalhado pelas rotas. Adicionar uma ação nova é adicionar uma linha aqui,
 * não caçar todo lugar que checa papel.
 */
const PERMISSOES: Record<Papel, readonly string[]> = {
  lider: ['culto:escrever', 'avisos:escrever', 'pessoas:escrever'],
  coordenador: ['escala:escrever'],
  operador: ['culto:avancar', 'avisos:publicar', 'escala:presenca'],
  area: [],
};

/** Se o papel tem permissão para a ação. Ações não listadas são negadas. */
export function podeFazer(papel: Papel, acao: string): boolean {
  return PERMISSOES[papel]?.includes(acao) ?? false;
}

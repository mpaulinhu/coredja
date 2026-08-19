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
 * Os cinco papéis do Coredja publicado, do mais para o menos amplo.
 *
 * - `admin`: gerencia quem tem conta e o que cada pessoa pode ver — a única
 *   coisa que o admin faz é cuidar de gente, não de conteúdo do dia a dia.
 * - `lider`: monta a ordem do culto e os avisos.
 * - `coordenador`: monta a escala do time.
 * - `operador`: só executa no domingo — avança a ordem, publica o aviso no
 *   telão, marca presença. Não edita o que foi preparado na semana.
 * - `area`: não é bem um papel de pessoa — existe aqui só para o código que
 *   confere permissão poder tratar link-de-área e login-de-pessoa de forma
 *   parecida quando fizer sentido. A maioria das checagens não vai usar isto.
 */
export type Papel = 'admin' | 'lider' | 'coordenador' | 'operador' | 'area';

/**
 * Uma pessoa com login no Coredja.
 *
 * `papeis` é uma lista, não um valor só: numa igreja pequena a mesma pessoa
 * costuma acumular funções (ex: quem lidera também administra o acesso dos
 * outros). Uma pessoa tem uma ação liberada se QUALQUER papel na lista
 * permitir — ver `podeFazer`.
 *
 * `areasVisiveis` é só para a tela de Recados — controla quais conversas
 * (Cantina, Kids, ...) a pessoa enxerga no Painel. Vazio ou ausente
 * significa nenhuma área liberada, não "todas": é mais seguro que uma
 * pessoa nova comece sem ver nada e o admin libere explicitamente, do que
 * ela nascer vendo tudo por engano numa lista esquecida.
 */
export interface Pessoa {
  /** UID do Firebase Authentication — é também o id do documento. */
  uid: string;
  nome: string;
  email: string;
  papeis: Papel[];
  /** Slugs das áreas (ver `areas.ts`) cujos recados esta pessoa pode ver. */
  areasVisiveis?: string[];
}

/**
 * O que cada papel pode fazer, numa tabela — em vez de `if papel === ...`
 * espalhado pelas rotas. Adicionar uma ação nova é adicionar uma linha aqui,
 * não caçar todo lugar que checa papel.
 */
const PERMISSOES: Record<Papel, readonly string[]> = {
  admin: ['pessoas:escrever'],
  lider: ['culto:escrever', 'avisos:escrever'],
  coordenador: ['escala:escrever'],
  operador: ['culto:avancar', 'avisos:publicar', 'escala:presenca'],
  area: [],
};

/** Se algum dos papéis da pessoa tem permissão para a ação. */
export function podeFazer(papeis: Papel[], acao: string): boolean {
  return papeis.some((papel) => PERMISSOES[papel]?.includes(acao) ?? false);
}

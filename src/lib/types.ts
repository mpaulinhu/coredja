/**
 * Contrato de dados do Coredja.
 *
 * Estes tipos são a fronteira entre as telas e o armazenamento. Hoje o
 * armazenamento é SQLite local; amanhã pode ser Firebase. As telas conhecem
 * apenas o que está aqui — por isso a migração não as afeta.
 */

/**
 * Um departamento da igreja (ex: Cantina, Kids, Audiovisual). Qualquer
 * departamento pode conversar com qualquer outro — ver `conversas.ts`.
 *
 * O slug `'audiovisual'` (ver `AUDIOVISUAL_SLUG` em `conversas.ts`) é
 * reservado por igualdade de string, não por um campo booleano gravado aqui:
 * um campo desses seria uma segunda fonte de verdade que alguém apaga sem
 * querer editando pelo CRUD de Departamentos.
 */
export interface Departamento {
  /** Identificador estável, usado no código e nas queries. Ex: "cantina". */
  slug: string;
  /** Nome exibido na tela. Ex: "Cantina". */
  nome: string;
  /** Cor de destaque do departamento no painel, em hex. */
  cor: string;
}

/** Urgência de um recado. Define ordenação e destaque visual no painel. */
export type Prioridade = 'normal' | 'urgente';

/** Uma imagem anexada a um recado (banner da cantina, por exemplo). */
export interface Anexo {
  id: string;
  /** Nome original do arquivo, preservado para o download. */
  nomeArquivo: string;
  /** Tipo MIME validado no envio. */
  tipo: string;
  /** Tamanho em bytes. */
  tamanho: number;
  /**
   * Caminho para buscar a imagem. Hoje aponta para uma rota local que lê do
   * disco; com Firebase passará a ser a URL do Storage. Quem exibe não precisa
   * saber a diferença.
   */
  url: string;
}

/**
 * Um recado trocado entre dois departamentos.
 *
 * `prioridade`/`resolvidaEm` continuam existindo em toda mensagem (mesmo
 * schema para todas), mas ficam semanticamente inertes (sempre `null`) fora
 * de conversas com o Audiovisual — ver `conversaTemUrgencia` em
 * `conversas.ts`. Evita duas tabelas/coleções de mensagem.
 */
export interface Mensagem {
  id: string;
  /** Id determinístico da conversa — ver `idDaConversa` em `conversas.ts`. */
  conversaId: string;
  /** Slug do departamento que escreveu este recado. */
  remetente: string;
  /**
   * Nome de quem escreveu, dentro do departamento — o painel exibe
   * "Departamento · Pessoa".
   *
   * Opcional porque recado gravado antes deste campo existir não tem como
   * saber quem foi: ali o painel mostra só o departamento, sem migração
   * nenhuma. Também fica ausente no recado que chega pelo link de área, que
   * não tem pessoa logada por trás.
   */
  autor?: string;
  texto: string;
  prioridade: Prioridade | null;
  /** ISO 8601 em UTC. A tela converte para o horário local ao exibir. */
  criadaEm: string;
  /** Preenchido quando o recado é marcado como resolvido. */
  resolvidaEm: string | null;
  anexos: Anexo[];
}

/** Dados necessários para criar um recado. O resto o armazenamento preenche. */
export interface NovaMensagem {
  conversaId: string;
  remetente: string;
  /** Nome de quem escreveu — ver `autor` em `Mensagem`. */
  autor?: string;
  texto: string;
  prioridade: Prioridade | null;
  anexos: Omit<Anexo, 'id'>[];
}

/** Uma conversa que já tem pelo menos um recado — ver `listarConversasComMensagem`. */
export interface ConversaComMensagem {
  conversaId: string;
  deptoA: string;
  deptoB: string;
}

/**
 * Operações de dados do Coredja.
 *
 * Implementada hoje por SQLite (`sqlite-store.ts`). Uma futura implementação
 * Firebase só precisa satisfazer esta mesma interface para substituí-la.
 */
export interface Store {
  listarDepartamentos(): Promise<Departamento[]>;
  buscarDepartamento(slug: string): Promise<Departamento | null>;
  criarDepartamento(dados: Departamento): Promise<Departamento>;
  atualizarDepartamento(
    slug: string,
    dados: Omit<Departamento, 'slug'>,
  ): Promise<Departamento | null>;
  removerDepartamento(slug: string): Promise<void>;

  criarMensagem(dados: NovaMensagem): Promise<Mensagem>;
  /** Recados ainda não resolvidos, urgentes primeiro, mais recentes antes. */
  listarPendentes(): Promise<Mensagem[]>;
  /** Recados já resolvidos, do mais recente para o mais antigo. */
  listarHistorico(limite?: number): Promise<Mensagem[]>;
  /** Conversa entre dois departamentos: tudo que os dois trocaram. */
  listarPorConversa(conversaId: string, limite?: number): Promise<Mensagem[]>;
  /** As conversas que já têm pelo menos um recado — deriva a lista sem uma tabela própria. */
  listarConversasComMensagem(): Promise<ConversaComMensagem[]>;
  /** Um recado pelo id. Serve para conferir a conversa dele antes de alterá-lo. */
  buscarMensagem(id: string): Promise<Mensagem | null>;
  resolverMensagem(id: string): Promise<Mensagem | null>;
  /** Devolve um recado resolvido para a lista de pendentes. */
  reabrirMensagem(id: string): Promise<Mensagem | null>;

  /**
   * Apaga um recado de vez. Diferente de resolver, que só o tira da lista
   * ativa e o guarda no histórico — aqui não há como desfazer.
   */
  apagarMensagem(id: string): Promise<void>;
  /** Apaga TODOS os recados de uma conversa. Devolve quantos saíram. */
  apagarConversa(conversaId: string): Promise<number>;
  /**
   * Apaga recados resolvidos há mais de `dias`. Devolve quantos saíram.
   *
   * Só mexe em resolvido: um recado que ninguém resolveu ainda importa,
   * por mais antigo que seja, e sumir com ele sozinho seria perder o que
   * alguém ainda espera ver.
   */
  apagarResolvidosAntigos(dias: number): Promise<number>;
}

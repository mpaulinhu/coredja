/**
 * Contrato de dados do Coredja.
 *
 * Estes tipos são a fronteira entre as telas e o armazenamento. Hoje o
 * armazenamento é SQLite local; amanhã pode ser Firebase. As telas conhecem
 * apenas o que está aqui — por isso a migração não as afeta.
 */

/** Uma área da igreja que envia recados ao audiovisual (ex: Cantina, Kids). */
export interface Area {
  /** Identificador estável, usado no código e nas queries. Ex: "cantina". */
  slug: string;
  /** Nome exibido na tela. Ex: "Cantina". */
  nome: string;
  /**
   * Trecho secreto da URL de acesso da área. O link fica /a/{slug}-{token}.
   * Trocar este valor invalida o link antigo sem afetar o histórico.
   */
  token: string;
  /** Cor de destaque da área no painel, em hex. */
  cor: string;
}

/** Urgência de um recado. Define ordenação e destaque visual no painel. */
export type Prioridade = 'normal' | 'urgente';

/** Quem escreveu a mensagem. */
export type Autor = 'area' | 'audiovisual';

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

/** Um recado trocado entre uma área e o audiovisual. */
export interface Mensagem {
  id: string;
  /** Slug da área a que este recado pertence. */
  areaSlug: string;
  autor: Autor;
  texto: string;
  prioridade: Prioridade;
  /** ISO 8601 em UTC. A tela converte para o horário local ao exibir. */
  criadaEm: string;
  /** Preenchido quando o audiovisual marca o recado como resolvido. */
  resolvidaEm: string | null;
  anexos: Anexo[];
}

/** Dados necessários para criar um recado. O resto o armazenamento preenche. */
export interface NovaMensagem {
  areaSlug: string;
  autor: Autor;
  texto: string;
  prioridade: Prioridade;
  anexos: Omit<Anexo, 'id'>[];
}

/**
 * Operações de dados do Coredja.
 *
 * Implementada hoje por SQLite (`sqlite-store.ts`). Uma futura implementação
 * Firebase só precisa satisfazer esta mesma interface para substituí-la.
 */
export interface Store {
  listarAreas(): Promise<Area[]>;
  buscarArea(slug: string): Promise<Area | null>;
  /** Valida o par slug/token de um link de área. Retorna null se não confere. */
  autenticarArea(slug: string, token: string): Promise<Area | null>;

  criarMensagem(dados: NovaMensagem): Promise<Mensagem>;
  /** Recados ainda não resolvidos, urgentes primeiro, mais recentes antes. */
  listarPendentes(): Promise<Mensagem[]>;
  /** Recados já resolvidos, do mais recente para o mais antigo. */
  listarHistorico(limite?: number): Promise<Mensagem[]>;
  /** Conversa de uma área: o que ela mandou e o que o audiovisual respondeu. */
  listarPorArea(areaSlug: string, limite?: number): Promise<Mensagem[]>;
  resolverMensagem(id: string): Promise<Mensagem | null>;
  /** Devolve um recado resolvido para a lista de pendentes. */
  reabrirMensagem(id: string): Promise<Mensagem | null>;
}

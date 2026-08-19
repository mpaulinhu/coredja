/**
 * Contrato de dados dos Avisos do Telão.
 *
 * Ao contrário da Ordem do Culto (um documento só, o "culto de hoje"), aviso
 * é uma LISTA: vários cadastrados durante a semana, dos quais um — no máximo
 * — está "no ar" a qualquer momento. É essa a tela que expôs a premissa
 * errada do primeiro mapa: cadastrar acontece na semana, publicar acontece no
 * domingo, e são pessoas diferentes fazendo isso em momentos diferentes.
 */

export interface Aviso {
  id: string;
  titulo: string;
  texto: string;
  /** Se este é o aviso mostrado no telão agora. No máximo um por vez. */
  noAr: boolean;
  criadoPor: string;
  criadoEm: string; // ISO 8601 em UTC
}

/** O que a tela de cadastro envia ao criar um aviso. */
export interface NovoAviso {
  titulo: string;
  texto: string;
}

export interface StoreAvisos {
  listar(): Promise<Aviso[]>;
  criar(dados: NovoAviso, autor: string): Promise<Aviso>;
  remover(id: string): Promise<void>;
  /** Põe este aviso no ar e tira qualquer outro que estivesse — nunca dois
   *  ao mesmo tempo. */
  publicar(id: string): Promise<Aviso[]>;
  /** Tira o aviso do ar. O telão volta a não mostrar nenhum. */
  ocultar(id: string): Promise<Aviso[]>;
}

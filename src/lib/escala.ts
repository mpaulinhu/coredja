/**
 * Contrato de dados da Escala do Time.
 *
 * Documento único (id "atual"), igual `culto.ts` — a escala de UM domingo por
 * vez, substituída quando o coordenador monta a próxima. Ver a nota em
 * `culto.ts` sobre por que histórico/calendário fica para depois.
 *
 * Diferente de Ordem do Culto e Avisos, a Escala não exige que cada pessoa
 * escalada tenha login: quem monta (coordenador) faz login; quem está
 * escalado é só um nome numa lista, sem conta própria. Criar login para
 * cada voluntário do time técnico seria peso desproporcional ao problema —
 * a dor original era "quem tá escalado, quem faltou", não "cada pessoa
 * gerencia a própria agenda".
 */

/** As funções do time técnico. Fixas em código — ver a mesma decisão em
 *  `areas.ts` para o porquê de não ser uma tela de cadastro. */
export const FUNCOES = ['Som', 'Projeção', 'Câmera', 'Transmissão'] as const;
export type Funcao = (typeof FUNCOES)[number];

/** Uma pessoa escalada para uma função, num domingo. */
export interface Escalado {
  id: string;
  funcao: Funcao;
  nome: string;
  /** Preenchido quando a pessoa confirma presença — no domingo, ou antes. */
  presente: boolean;
}

export interface Escala {
  data: string; // ISO 8601, só a data
  escalados: Escalado[];
  editadoPor: string;
  editadoEm: string; // ISO 8601 em UTC
}

export interface NovaEscala {
  data: string;
  escalados: Omit<Escalado, 'presente'>[];
}

export interface StoreEscala {
  buscar(): Promise<Escala | null>;
  salvar(dados: NovaEscala, autor: string): Promise<Escala>;
  /** Alterna presente/ausente para uma pessoa escalada. */
  marcarPresenca(id: string, presente: boolean): Promise<Escala | null>;
}

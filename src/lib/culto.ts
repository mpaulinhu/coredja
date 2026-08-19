/**
 * Contrato de dados da Ordem do Culto.
 *
 * Existe UM documento de culto por vez — o próximo domingo. Terminado o
 * culto, um líder monta o de cima em cima do anterior (substitui, não
 * acumula histórico). Um calendário com vários cultos futuros e um arquivo do
 * que já passou é melhoria natural, mas não é o que a primeira versão
 * precisa: hoje a dor é "o operador não sabe o que vem depois", não "preciso
 * consultar o culto de três semanas atrás".
 *
 * Documento único, id fixo `atual`, na coleção `culto`.
 */

export type IdBloco = string;

/** Um bloco da sequência do culto (ex: "Louvor", "Palavra"). */
export interface Bloco {
  id: IdBloco;
  titulo: string;
  /** Minutos previstos. Só orientativo — nada impede passar do tempo. */
  minutos: number;
}

/** O culto de hoje: a sequência montada e qual bloco está em andamento. */
export interface Culto {
  data: string; // ISO 8601, só a data (ex: "2026-08-24")
  blocos: Bloco[];
  /** id do bloco em andamento. null antes de começar, ou após o último. */
  blocoAtualId: IdBloco | null;
  /** Quem montou por último, para a tela mostrar "editado por fulano". */
  editadoPor: string;
  editadoEm: string; // ISO 8601 em UTC
}

/** O que a tela de montagem envia ao salvar. */
export interface NovoCulto {
  data: string;
  blocos: Bloco[];
}

export interface StoreCulto {
  buscar(): Promise<Culto | null>;
  salvar(dados: NovoCulto, autor: string): Promise<Culto>;
  /** Avança para o próximo bloco, ou o primeiro, se ainda não começou. */
  avancar(): Promise<Culto | null>;
  /** Volta para null — o culto para de estar "em andamento". */
  reiniciar(): Promise<Culto | null>;
}

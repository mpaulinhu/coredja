/**
 * Contrato de dados da Ordem do Culto.
 *
 * A primeira versão guardava UM documento só (id fixo `atual`): montar o culto
 * novo apagava o anterior. Isso deixou de servir quando apareceu a necessidade
 * real de preparar mais de um culto de uma vez — o domingo, a quarta, o
 * domingo seguinte — cada um com sua data, sem que salvar um destruísse o
 * outro.
 *
 * Agora cada ordem é um documento próprio na coleção `culto`, com o id sendo a
 * PRÓPRIA DATA (`"2026-08-24"`). Id determinístico porque não faz sentido ter
 * duas ordens para o mesmo dia: salvar de novo para uma data existente é a
 * mesma ordem sendo corrigida, e sobrescrever é exatamente o comportamento
 * desejado. Como efeito colateral bem-vindo, ordenar por id é ordenar por
 * data.
 *
 * Qual ordem "vale" no domingo não é marcado por ninguém — é derivado da data
 * (ver `buscarAtiva`). Ninguém precisa lembrar de publicar ou despublicar
 * nada; o calendário decide.
 */

export type IdBloco = string;

/** Um bloco da sequência do culto (ex: "Louvor", "Palavra"). */
export interface Bloco {
  id: IdBloco;
  titulo: string;
  /** Minutos previstos. Só orientativo — nada impede passar do tempo. */
  minutos: number;
}

/** Uma ordem de culto: a sequência montada e qual bloco está em andamento. */
export interface Culto {
  /** Igual a `data` — o id do documento no Firestore. Ver nota no topo. */
  id: string;
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

export interface StoreCulto {
  /** Todas as ordens, da mais antiga para a mais nova. */
  listar(): Promise<Culto[]>;
  buscar(id: string): Promise<Culto | null>;
  /**
   * A ordem que vale agora: a de hoje; se não houver, a próxima futura mais
   * próxima. null se só existem ordens passadas (ou nenhuma).
   */
  buscarAtiva(): Promise<Culto | null>;
  /** Cria ou sobrescreve a ordem daquela data. */
  salvar(dados: NovoCulto, autor: string): Promise<Culto>;
  remover(id: string): Promise<void>;
  /** Avança para o próximo bloco, ou o primeiro, se ainda não começou. */
  avancar(id: string): Promise<Culto | null>;
  /** Volta para null — o culto para de estar "em andamento". */
  reiniciar(id: string): Promise<Culto | null>;
}

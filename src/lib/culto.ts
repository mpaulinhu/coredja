/**
 * Contrato de dados da Ordem do Culto.
 *
 * A primeira versão guardava UM documento só (id fixo `atual`): montar o culto
 * novo apagava o anterior. Isso deixou de servir quando apareceu a necessidade
 * real de preparar mais de um culto de uma vez — o domingo, a quarta, o
 * domingo seguinte — cada um com sua data, sem que salvar um destruísse o
 * outro. Essa segunda versão guardava uma ordem por DATA (`"2026-08-24"`).
 *
 * Agora existe uma terceira necessidade: mais de uma ordem no MESMO dia (culto
 * de manhã e de noite). O id deixou de poder ser só a data — duas ordens no
 * mesmo domingo colidiriam. O esquema atual é `id = "{data}__{hora}"`
 * (`"2026-08-24__09:00"`), que:
 *
 * - Preserva ordenação lexicográfica natural: data e hora ordenam certo como
 *   string, então ordenar por id continua sendo ordenar por quando acontece.
 * - Continua determinístico: duas ordens salvas para a mesma data+hora
 *   sobrescrevem uma a outra — é a mesma ordem sendo corrigida, mesma regra
 *   que "mesma data" tinha antes, generalizada para incluir a hora.
 *
 * Qual ordem "vale" agora não é marcado por ninguém — é derivado da data+hora
 * mais próxima de agora, entre as de hoje (ver `buscarAtiva`), descontadas as
 * concluídas manualmente. Ninguém precisa lembrar de publicar ou despublicar
 * nada; o relógio decide — exceto quando alguém marca "Concluir" para tirar
 * uma ordem do posto antes da hora (culto que terminou mais cedo, por
 * exemplo), o que `concluidoEm` existe para registrar.
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
  /** `"{data}__{hora}"` — o id do documento no Firestore. Ver nota no topo. */
  id: string;
  data: string; // ISO 8601, só a data (ex: "2026-08-24")
  hora: string; // "HH:MM", 24h (ex: "09:00")
  blocos: Bloco[];
  /** id do bloco em andamento. null antes de começar, ou após o último. */
  blocoAtualId: IdBloco | null;
  /**
   * Quando esta ordem foi marcada "concluída" manualmente. null enquanto
   * aberta. Independente de `blocoAtualId`: dá para concluir sem ter avançado
   * por todos os blocos (culto que encurtou), e o avanço automático pelos
   * blocos não conclui sozinho — só o clique explícito faz.
   */
  concluidoEm: string | null;
  /** Quem montou por último, para a tela mostrar "editado por fulano". */
  editadoPor: string;
  editadoEm: string; // ISO 8601 em UTC
}

/** O que a tela de montagem envia ao salvar. */
export interface NovoCulto {
  data: string;
  hora: string;
  blocos: Bloco[];
}

/**
 * Um modelo salvo: só a sequência de blocos, sem data/hora/estado — reutilizável
 * ao montar uma ordem nova. Coleção separada (`culto_modelos`) porque são
 * poucos, pequenos, e não têm nada a ver com "quando" um culto acontece.
 */
export interface ModeloCulto {
  id: string;
  nome: string;
  blocos: Bloco[];
  criadoPor: string;
  criadoEm: string; // ISO 8601 em UTC
}

export interface NovoModelo {
  nome: string;
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

/** `"HH:MM"` agora, no fuso de quem roda o servidor. */
export function horaLocal(agora: Date = new Date()): string {
  const horas = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

/** Monta o id determinístico de uma ordem a partir de data+hora. */
export function idDoCulto(data: string, hora: string): string {
  return `${data}__${hora}`;
}

export interface StoreCulto {
  /** Todas as ordens, da mais antiga para a mais nova (data, depois hora). */
  listar(): Promise<Culto[]>;
  buscar(id: string): Promise<Culto | null>;
  /**
   * A ordem que vale agora: entre as de hoje que ainda não foram concluídas,
   * a de horário mais próximo do agora (passado ou futuro); se não houver
   * nenhuma hoje, a próxima futura mais próxima. null se só existem ordens
   * passadas, todas as de hoje já concluídas, ou nenhuma ordem.
   */
  buscarAtiva(): Promise<Culto | null>;
  /** Cria ou sobrescreve a ordem daquela data+hora. */
  salvar(dados: NovoCulto, autor: string): Promise<Culto>;
  remover(id: string): Promise<void>;
  /** Avança para o próximo bloco, ou o primeiro, se ainda não começou. */
  avancar(id: string): Promise<Culto | null>;
  /** Volta para null — o culto para de estar "em andamento". */
  reiniciar(id: string): Promise<Culto | null>;
  /** Marca/desmarca `concluidoEm`. `concluir(id, false)` reabre. */
  concluir(id: string, concluir: boolean): Promise<Culto | null>;

  listarModelos(): Promise<ModeloCulto[]>;
  salvarModelo(dados: NovoModelo, autor: string): Promise<ModeloCulto>;
  removerModelo(id: string): Promise<void>;
}

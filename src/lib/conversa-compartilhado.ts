import type { Departamento, Mensagem } from './types';

/**
 * Peças do modelo de conversa que não dependem do armazenamento (`store`) —
 * seguras para importar tanto no servidor quanto em Client Components.
 *
 * `montarConversas` (em `conversas.ts`) fica de fora deste arquivo de
 * propósito: ela usa `store`, que carrega `firebase-admin` (Node-only,
 * quebra o bundle do navegador). Um Client Component como
 * `PainelAudiovisual.tsx` importa só daqui.
 */

/** Slug reservado do departamento de audiovisual — ver `conversaTemUrgencia`. */
export const AUDIOVISUAL_SLUG = 'audiovisual';

/**
 * Id determinístico de uma conversa entre dois departamentos. Não depende de
 * ordem de chamada nem de uma tabela/coleção própria de conversas — a lista
 * de conversas existentes é derivada agrupando mensagens por este id (ver
 * `Store.listarConversasComMensagem`).
 */
export function idDaConversa(a: string, b: string): string {
  return [a, b].sort().join('__');
}

/**
 * Se a conversa entre estes dois departamentos carrega o aparato de urgência
 * (toggle "Urgente", pendente/resolvido, botões resolver/reabrir). Só as
 * conversas que envolvem o Audiovisual têm isso — as demais são só troca de
 * mensagem, sem esse fluxo operacional.
 */
export function conversaTemUrgencia(a: string, b: string): boolean {
  return a === AUDIOVISUAL_SLUG || b === AUDIOVISUAL_SLUG;
}

/** Uma conversa entre dois departamentos, do jeito que o painel precisa exibir. */
export interface Conversa {
  deptoA: Departamento;
  deptoB: Departamento;
  /** Se esta conversa carrega o aparato de urgência — ver `conversaTemUrgencia`. */
  temUrgencia: boolean;
  /** Toda a troca entre os dois, da mais antiga para a mais recente. */
  mensagens: Mensagem[];
  /** Recados ainda não resolvidos. É o que o crachá mostra. */
  pendentes: number;
  /** Se algum dos pendentes é urgente — define o destaque em vermelho. */
  temUrgente: boolean;
  /** Última mensagem da conversa, para a prévia na lista. */
  ultima: Mensagem | null;
}

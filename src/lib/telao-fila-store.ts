/**
 * Grava comandos na fila do telão — o lado servidor do caminho da ponte.
 *
 * Ver `telao-fila.ts` para o desenho e o porquê. Aqui é só a escrita no
 * Firestore, isolada num arquivo próprio porque importa `firebase-admin` e
 * não pode ser puxado por Componente de Cliente (mesmo motivo de
 * `conversa-compartilhado.ts`).
 */

import { getFirestoreDb } from './firebase';
import {
  VALIDADE_MS,
  type ComandoDoTelao,
  type TipoDeComando,
} from './telao-fila';

const COLECAO = 'telao_comandos';

/**
 * Quanto tempo a ponte pode ficar sem dar sinal antes de ser considerada
 * fora do ar.
 *
 * 45 segundos, contra um sinal a cada ~15s (a ponte decide o intervalo dela):
 * tolera dois sinais perdidos por oscilação de rede antes de acusar problema.
 * Acusar cedo demais faria o selo de "telão desconectado" piscar sozinho no
 * meio do culto, que é pior que demorar meio minuto para notar.
 */
const VALIDADE_DO_SINAL_MS = 45_000;

const DOC_SINAL = 'ponte';
const COLECAO_SINAL = 'telao_estado';

/**
 * Enfileira um comando. Devolve `false` se não deu para gravar.
 *
 * Nunca lança: quem chama está no meio de avançar um bloco de culto, e o
 * telão é o acessório. Falhar aqui não pode derrubar a ação principal — o
 * mesmo princípio que `holyrics.ts` já segue.
 */
export async function enfileirarComando(
  tipo: TipoDeComando,
  dados: Record<string, unknown>,
  porQuem?: string,
): Promise<boolean> {
  const agora = Date.now();
  const comando: Omit<ComandoDoTelao, 'id'> = {
    tipo,
    dados,
    criadoEm: new Date(agora).toISOString(),
    expiraEm: new Date(agora + VALIDADE_MS).toISOString(),
    ...(porQuem ? { porQuem } : {}),
  };

  try {
    await getFirestoreDb().collection(COLECAO).add(comando);
    return true;
  } catch {
    return false;
  }
}

/**
 * Quando a ponte deu sinal pela última vez, ou `null` se nunca deu.
 *
 * É o que permite dizer "telão desconectado" com o Coredja hospedado, onde
 * sondar o Holyrics direto não funciona (ver `holyrics-presenca.ts`).
 */
export async function ultimoSinalDaPonte(): Promise<Date | null> {
  try {
    const doc = await getFirestoreDb()
      .collection(COLECAO_SINAL)
      .doc(DOC_SINAL)
      .get();
    if (!doc.exists) return null;

    const quando = (doc.data() ?? {}).vistaEm;
    if (typeof quando !== 'string') return null;

    const data = new Date(quando);
    return Number.isFinite(data.getTime()) ? data : null;
  } catch {
    return null;
  }
}

/** Se a ponte deu sinal recente o bastante para ser considerada no ar. */
export async function ponteEstaViva(): Promise<boolean> {
  const ultimo = await ultimoSinalDaPonte();
  if (!ultimo) return false;
  return Date.now() - ultimo.getTime() < VALIDADE_DO_SINAL_MS;
}

/**
 * Registra que a ponte está viva. Chamado pela própria ponte, pela rota
 * `/api/telao/sinal`.
 *
 * `merge: true` porque o documento pode ganhar outros campos depois (versão
 * da ponte, nome do PC) sem que esta função precise conhecê-los.
 */
export async function registrarSinalDaPonte(
  extras: Record<string, unknown> = {},
): Promise<void> {
  await getFirestoreDb()
    .collection(COLECAO_SINAL)
    .doc(DOC_SINAL)
    .set({ ...extras, vistaEm: new Date().toISOString() }, { merge: true });
}

import {
  iniciarCronometroNoHolyrics,
  pararCronometroNoHolyrics,
  type ResultadoHolyrics,
} from './holyrics';

/**
 * Põe o cronômetro do Holyrics no tempo do bloco que passou a ser o atual.
 *
 * Mora aqui, e não dentro de uma rota, porque duas rotas mudam o bloco atual
 * e precisam do MESMO efeito no cronômetro: `avancar` (sequencial) e `bloco`
 * (pular direto para um). Duplicar isso deixaria as duas livres para
 * divergirem — e o operador veria o relógio se comportar diferente conforme
 * clicou em "Avançar" ou no nome do bloco.
 *
 * Dois casos que não são erro e por isso não viram cronômetro novo:
 * - **Acabou o culto** (`blocoAtualId` volta a `null` depois do último bloco,
 *   ver `culto-store.avancar`): o certo é PARAR, senão o cronômetro do último
 *   bloco fica correndo negativo para sempre na tela de retorno.
 * - **Bloco sem minutos** (`0` ou ausente): cronometrar zero não significa
 *   nada. Deixa como está, sem tratar como falha.
 */
export async function ajustarCronometroDoBloco(
  blocoAtualId: string | null,
  blocos: { id: string; minutos: number }[],
): Promise<ResultadoHolyrics | null> {
  if (blocoAtualId === null) return pararCronometroNoHolyrics();

  const bloco = blocos.find((b) => b.id === blocoAtualId);
  const minutos = bloco?.minutos ?? 0;
  if (minutos <= 0) return null;

  return iniciarCronometroNoHolyrics(minutos);
}

import { ehAPonte, recusarPonte } from '@/lib/ponte-autenticacao';
import { registrarSinalDaPonte } from '@/lib/telao-fila-store';

export const dynamic = 'force-dynamic';

/**
 * A ponte dizendo que está viva.
 *
 * Chamado a cada poucos segundos pelo programa no PC do audiovisual. É o que
 * permite ao Coredja publicado mostrar "telão desconectado" antes do domingo:
 * sem a ponte dando sinal, sondar o Holyrics direto não funciona de fora da
 * rede da igreja (ver `holyrics-presenca.ts` e `telao-fila.ts`).
 *
 * Também é o que decide, em `entregar()` de `holyrics.ts`, se vale a pena
 * enfileirar um comando: sem ponte viva, enfileirar seria deixar recado para
 * ninguém — melhor devolver o erro na hora, para quem clicou saber que
 * precisa projetar à mão.
 */
export async function POST(request: Request) {
  if (!ehAPonte(request)) return recusarPonte();

  // Campos livres que a ponte manda para o diagnóstico ficar útil: qual PC
  // está servindo de ponte e qual versão está instalada. Nada disso é
  // confiável para decisão de segurança — é informação para quem lê a tela.
  let extras: Record<string, unknown> = {};
  try {
    const corpo = (await request.json()) as Record<string, unknown>;
    extras = {
      versao: typeof corpo.versao === 'string' ? corpo.versao : undefined,
      computador: typeof corpo.computador === 'string' ? corpo.computador : undefined,
      holyricsOk: corpo.holyricsOk === true,
    };
  } catch {
    // Sinal sem corpo continua valendo: o que importa é ter chegado.
  }

  try {
    await registrarSinalDaPonte(extras);
  } catch {
    return Response.json({ erro: 'Não foi possível registrar.' }, { status: 503 });
  }

  return Response.json({ ok: true });
}

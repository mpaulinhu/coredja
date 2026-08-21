import { getFirestoreDb } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

/** Agora EXECUTA getFirestoreDb() dentro de um try/catch explícito, com
 * console.error para aparecer no log de Functions da Netlify. */
export async function GET() {
  try {
    const db = getFirestoreDb();
    return Response.json({ ok: true, temDb: Boolean(db) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : null;
    console.error('ERRO EM /api/oi2:', msg, stack);
    return Response.json({ ok: false, erro: msg, stack }, { status: 200 });
  }
}

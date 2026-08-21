import { getFirestoreDb } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

/** Igual a /api/oi, mas com o import de firebase.ts — SEM chamar
 * getFirestoreDb(). Se importar (sem executar) já quebra, o problema é o
 * módulo em si (algo no top-level do arquivo, ou uma dependência dele que
 * falha ao carregar). */
export async function GET() {
  return Response.json({ ok: true, importouSemExecutar: typeof getFirestoreDb });
}

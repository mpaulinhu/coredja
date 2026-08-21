export const dynamic = 'force-dynamic';

/** Testa se so o IMPORT de store.ts (que carrega better-sqlite3
 * incondicionalmente) ja quebra, mesmo sem chamar nada. */
export async function GET() {
  try {
    const mod = await import('@/lib/store');
    return Response.json({ ok: true, armazenamento: mod.ARMAZENAMENTO_ATIVO });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : null;
    console.error('ERRO AO IMPORTAR store.ts:', msg, stack);
    return Response.json({ ok: false, erro: msg, stack }, { status: 200 });
  }
}

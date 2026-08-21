export const dynamic = 'force-dynamic';

/** Diagnostico v3: apos remover firebase-admin de serverExternalPackages,
 * confirma se o erro do jose/jwks-rsa continua (suspeita: o plugin da
 * Netlify tem sua propria logica de bundling por cima do Next). */
export async function GET() {
  const passos: Record<string, unknown> = {};

  try {
    await import('firebase-admin/auth');
    passos.firebaseAdminAuth = 'ok';
  } catch (e) {
    passos.firebaseAdminAuth = String(e instanceof Error ? e.message : e);
  }

  try {
    const { pessoaDaRequisicao } = await import('@/lib/sessao');
    const req = new Request('https://coreadja.netlify.app/api/oi5');
    const pessoa = await pessoaDaRequisicao(req);
    passos.pessoaDaRequisicao = pessoa === null ? 'null (esperado sem token)' : 'ok';
  } catch (e) {
    passos.pessoaDaRequisicao = String(e instanceof Error ? e.message : e);
  }

  return Response.json(passos);
}

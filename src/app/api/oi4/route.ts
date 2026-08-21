export const dynamic = 'force-dynamic';

/** Reconstroi departamentos/route.ts passo a passo, com try/catch em cada
 * import, pra achar exatamente qual modulo quebra. */
export async function GET() {
  const passos: Record<string, unknown> = {};

  try {
    await import('@/lib/departamento-validacao');
    passos.departamentoValidacao = 'ok';
  } catch (e) {
    passos.departamentoValidacao = String(e instanceof Error ? e.message : e);
  }

  try {
    await import('@/lib/papeis');
    passos.papeis = 'ok';
  } catch (e) {
    passos.papeis = String(e instanceof Error ? e.message : e);
  }

  try {
    await import('@/lib/sessao');
    passos.sessao = 'ok';
  } catch (e) {
    passos.sessao = String(e instanceof Error ? e.message : e);
  }

  try {
    await import('@/lib/store');
    passos.store = 'ok';
  } catch (e) {
    passos.store = String(e instanceof Error ? e.message : e);
  }

  // agora chama pessoaDaRequisicao de verdade, com o Request desta chamada
  try {
    const { pessoaDaRequisicao } = await import('@/lib/sessao');
    const req = new Request('https://coreadja.netlify.app/api/oi4');
    const pessoa = await pessoaDaRequisicao(req);
    passos.pessoaDaRequisicaoSemToken = pessoa === null ? 'null (esperado)' : JSON.stringify(pessoa);
  } catch (e) {
    passos.pessoaDaRequisicaoSemToken = String(e instanceof Error ? e.message : e);
    passos.pessoaDaRequisicaoStack = e instanceof Error ? e.stack : null;
  }

  return Response.json(passos);
}

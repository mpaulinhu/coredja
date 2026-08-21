export const dynamic = 'force-dynamic';

/** Rota mínima de sanidade — sem nenhum import do projeto. Se isto também
 * quebrar em produção, o problema não está no código de nenhuma rota, está
 * em algo mais básico (build, runtime, config da plataforma). */
export async function GET() {
  return Response.json({ ok: true, agora: new Date().toISOString() });
}

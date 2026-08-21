import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestoreDb } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

/**
 * Rota de diagnóstico TEMPORÁRIA (v2) — investigar o 500 nas rotas
 * autenticadas. A v1 confirmou que a conexão com o Firestore está OK; agora
 * testa o outro pedaço: verificar o token do Authorization, que usa
 * `firebase-admin/auth` e não `firebase-admin/firestore`.
 */
export async function GET(request: Request) {
  const diagnostico: Record<string, unknown> = {};

  try {
    getFirestoreDb();
    diagnostico.appInicializado = getApps().length > 0;
  } catch (e) {
    diagnostico.erroAoInicializar = e instanceof Error ? e.message : String(e);
    return Response.json(diagnostico, { status: 200 });
  }

  const cabecalho = request.headers.get('authorization') ?? '';
  const [tipo, token] = cabecalho.split(' ');
  diagnostico.recebeuToken = tipo === 'Bearer' && Boolean(token);
  diagnostico.tamanhoToken = token?.length ?? 0;

  if (!token) {
    diagnostico.observacao = 'Sem token no cabeçalho — mande Authorization: Bearer <token>';
    return Response.json(diagnostico);
  }

  try {
    const app = getApps()[0];
    const decodificado = await getAuth(app).verifyIdToken(token);
    diagnostico.tokenValido = true;
    diagnostico.uid = decodificado.uid;
    diagnostico.email = decodificado.email;
  } catch (e) {
    diagnostico.tokenValido = false;
    diagnostico.erroAoVerificarToken = e instanceof Error ? e.message : String(e);
    diagnostico.erroStack = e instanceof Error ? e.stack?.split('\n').slice(0, 6) : null;
    // Alguns erros do Admin SDK trazem `.code`
    diagnostico.erroCode = (e as { code?: string })?.code ?? null;
  }

  return Response.json(diagnostico);
}

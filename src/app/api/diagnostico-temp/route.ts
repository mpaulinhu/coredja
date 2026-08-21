import { getFirestoreDb } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

/**
 * Rota de diagnóstico TEMPORÁRIA — investigar o 500 sem corpo em produção.
 * Remover depois de descobrir a causa. Não exige autenticação de propósito
 * (é só para descobrir o ERRO, não expõe dado nenhum de pessoa/recado).
 */
export async function GET() {
  const diagnostico: Record<string, unknown> = {
    temCredencialAmbiente: Boolean(process.env.FIREBASE_CREDENCIAIS_JSON),
    tamanhoCredencialAmbiente: process.env.FIREBASE_CREDENCIAIS_JSON?.length ?? 0,
    projectIdEnv: process.env.FIREBASE_PROJECT_ID ?? null,
    storage: process.env.COREDJA_STORAGE ?? null,
  };

  try {
    const cred = process.env.FIREBASE_CREDENCIAIS_JSON;
    if (cred) {
      const parsed = JSON.parse(cred);
      diagnostico.credencialParseOk = true;
      diagnostico.credencialProjectId = parsed.project_id;
      diagnostico.credencialClientEmail = parsed.client_email;
      diagnostico.privateKeyComecaCom = String(parsed.private_key).slice(0, 30);
      diagnostico.privateKeyTerminaCom = String(parsed.private_key).slice(-30);
      diagnostico.privateKeyTemQuebraReal = String(parsed.private_key).includes('\n');
      diagnostico.privateKeyTemBarraNLiteral = String(parsed.private_key).includes('\n');
    }
  } catch (e) {
    diagnostico.credencialParseOk = false;
    diagnostico.erroDeParse = e instanceof Error ? e.message : String(e);
  }

  try {
    const db = getFirestoreDb();
    const snap = await db.collection('departamentos').limit(1).get();
    diagnostico.firestoreConectou = true;
    diagnostico.documentosLidos = snap.size;
  } catch (e) {
    diagnostico.firestoreConectou = false;
    diagnostico.erroFirestore = e instanceof Error ? e.message : String(e);
    diagnostico.erroFirestoreStack =
      e instanceof Error ? e.stack?.split('\n').slice(0, 5) : null;
  }

  return Response.json(diagnostico);
}

import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestoreDb } from './firebase';
import type { Papel, Pessoa } from './papeis';

/**
 * Confere quem é a pessoa por trás de uma requisição, do lado do servidor.
 *
 * O navegador manda o token do Firebase Authentication no cabeçalho
 * `Authorization: Bearer <token>`. Este arquivo confere que o token é
 * genuíno (via Admin SDK, que ignora `firestore.rules` — ver `firebase.ts`) e
 * então busca o papel da pessoa na coleção `pessoas`.
 *
 * Um token válido sem documento em `pessoas` NÃO é uma pessoa autorizada: só
 * prova que a pessoa tem uma conta, não que alguém deu acesso a ela. Ver o
 * comentário no topo de `papeis.ts`.
 */

const COLECAO_PESSOAS = 'pessoas';

/** Lê o token do cabeçalho Authorization. null se ausente ou malformado. */
function tokenDoCabecalho(request: Request): string | null {
  const cabecalho = request.headers.get('authorization') ?? '';
  const [tipo, token] = cabecalho.split(' ');
  return tipo === 'Bearer' && token ? token : null;
}

/**
 * Confere o token e devolve a pessoa autenticada, ou null se o token faltar,
 * for inválido, ou não corresponder a ninguém em `pessoas`.
 *
 * `getApps()[0]` reaproveita o app já inicializado por `getFirestoreDb()` —
 * chamar isto sem antes tocar o Firestore lançaria "no Firebase App".
 */
export async function pessoaDaRequisicao(request: Request): Promise<Pessoa | null> {
  const token = tokenDoCabecalho(request);
  if (!token) return null;

  getFirestoreDb(); // garante que o app do Admin SDK já existe
  const app = getApps()[0];
  if (!app) return null;

  let uid: string;
  try {
    const decodificado = await getAuth(app).verifyIdToken(token);
    uid = decodificado.uid;
  } catch {
    return null; // token expirado, revogado, ou forjado
  }

  const doc = await getFirestoreDb().collection(COLECAO_PESSOAS).doc(uid).get();
  if (!doc.exists) return null;

  const dados = doc.data() as { nome: string; email: string; papel: Papel };
  return { uid, nome: dados.nome, email: dados.email, papel: dados.papel };
}

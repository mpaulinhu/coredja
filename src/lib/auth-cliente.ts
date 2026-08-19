'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';

/**
 * Login do navegador, via Firebase Authentication.
 *
 * Mesmo padrão de `firebase-cliente.ts`: config pública, sem segredo aqui —
 * quem protege é o servidor, que confere o token em cada rota (ver
 * `sessao.ts`). Fica em arquivo próprio porque autenticação e leitura de
 * dados são preocupações diferentes, mesmo compartilhando o mesmo app do
 * Firebase por baixo.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cache: Auth | null = null;

function auth(): Auth {
  if (cache) return cache;
  const app = getApps().length
    ? getApp()
    : initializeApp(config as Required<typeof config>);
  cache = getAuth(app);
  return cache;
}

/** Tenta entrar com e-mail e senha. Lança o erro do Firebase em caso de falha. */
export async function entrar(email: string, senha: string): Promise<User> {
  const resultado = await signInWithEmailAndPassword(auth(), email, senha);
  return resultado.user;
}

export async function sair(): Promise<void> {
  await signOut(auth());
}

/**
 * Chama `ouvinte` sempre que o login mudar (entrou, saiu, ou ao carregar a
 * página com uma sessão já ativa). Devolve a função que cancela a escuta.
 */
export function escutarSessao(ouvinte: (usuario: User | null) => void): () => void {
  return onAuthStateChanged(auth(), ouvinte);
}

/**
 * O cabeçalho `Authorization` para chamar uma rota protegida do Coredja, ou
 * null se ninguém estiver logado. Toda tela que fala com uma API sob
 * `pessoaDaRequisicao` (ver `sessao.ts`) usa isto para se identificar.
 */
export async function cabecalhoDeAutorizacao(): Promise<Record<string, string> | null> {
  const usuario = auth().currentUser;
  if (!usuario) return null;
  const token = await usuario.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

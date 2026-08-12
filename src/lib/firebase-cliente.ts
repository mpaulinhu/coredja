'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Conexão do navegador com o Firestore.
 *
 * Diferente de `firebase.ts`, que roda no servidor com a chave de
 * administrador, este arquivo usa a configuração pública do projeto e obedece
 * às regras de `firestore.rules`: pode ler `mensagens` e `areas`, não pode
 * escrever nada.
 *
 * Serve a um único propósito — receber os avisos de mudança em tempo real,
 * para o recado aparecer no painel sem ninguém atualizar a página. Todo envio
 * continua passando pelo servidor.
 *
 * Estes valores não são segredo: toda página que usa Firebase os carrega
 * visíveis no navegador. Quem protege os dados são as regras, não eles.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Se o projeto não foi configurado, o tempo real do Firestore fica off. */
export function firebaseConfigurado(): boolean {
  return Boolean(config.apiKey && config.projectId);
}

let cache: Firestore | null = null;

/** Conexão de leitura com o Firestore, ou null se não houver configuração. */
export function getFirestoreCliente(): Firestore | null {
  if (!firebaseConfigurado()) return null;
  if (cache) return cache;

  const app = getApps().length
    ? getApp()
    : initializeApp(config as Required<typeof config>);

  cache = getFirestore(app);
  return cache;
}

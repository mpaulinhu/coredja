// Migração pontual do Firestore: Ordem do Culto de documento único
// (`culto/atual`) para uma ordem por data (`culto/{YYYY-MM-DD}`).
//
// NÃO É EXECUTADA AUTOMATICAMENTE. Rode manualmente uma vez, quando subir a
// versão que trabalha com várias ordens.
//
// Uso:
//   node scripts/migrar-culto-multiplas-ordens.mjs
//
// Credencial: mesmo padrão de src/lib/firebase.ts — lê de
// FIREBASE_CREDENCIAIS_JSON (variável de ambiente) ou de
// segredos/firebase-admin.json (arquivo local, fora do git).
//
// O que este script faz:
//   1. Lê o documento `culto/atual`, se existir.
//   2. Regrava o mesmo conteúdo em `culto/{data}`, onde `data` é o campo
//      `data` do próprio documento, acrescentando o campo `id` (igual à data)
//      que o schema novo espera.
//   3. Apaga `culto/atual`.
//
// Idempotente: se `culto/atual` não existir (já migrado, ou nunca houve
// ordem), avisa e sai sem tocar em nada. Se o destino `culto/{data}` já
// existir, o script para sem apagar nada — sinal de que alguém já montou a
// ordem daquela data no schema novo, e sobrescrever perderia trabalho.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COLECAO = 'culto';
const ID_ANTIGO = 'atual';

// --- Credencial: mesmo padrão de src/lib/firebase.ts -----------------------

const PASTA_SEGREDOS = path.join(process.cwd(), 'segredos');

function caminhoDaCredencial() {
  const nome = path.basename(
    process.env.FIREBASE_CREDENCIAIS ?? 'firebase-admin.json',
  );
  return path.join(PASTA_SEGREDOS, nome);
}

function lerCredencial() {
  const doAmbiente = process.env.FIREBASE_CREDENCIAIS_JSON;
  const caminho = caminhoDaCredencial();

  let bruto;
  if (doAmbiente && doAmbiente.trim()) {
    bruto = doAmbiente;
  } else if (existsSync(caminho)) {
    bruto = readFileSync(caminho, 'utf8');
  } else {
    throw new Error(
      `Credencial do Firebase não encontrada. Defina FIREBASE_CREDENCIAIS_JSON ` +
        `ou coloque o arquivo em "${caminho}" (ver src/lib/firebase.ts).`,
    );
  }

  const credencial = JSON.parse(bruto);
  if (!credencial.project_id || !credencial.private_key || !credencial.client_email) {
    throw new Error(
      `A credencial não parece ser uma chave de conta de serviço válida.`,
    );
  }
  return credencial;
}

function getDb() {
  const credencial = lerCredencial();
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: credencial.project_id,
        clientEmail: credencial.client_email,
        privateKey: credencial.private_key.replace(/\\n/g, '\n'),
      }),
      projectId: credencial.project_id,
    });
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

// --- Migração ----------------------------------------------------------

async function migrarCulto(db) {
  const colecao = db.collection(COLECAO);
  const antigo = await colecao.doc(ID_ANTIGO).get();

  if (!antigo.exists) {
    console.log(
      `Nenhum documento "${COLECAO}/${ID_ANTIGO}" encontrado — nada a migrar.`,
    );
    return;
  }

  const dados = antigo.data();
  const data = dados.data;

  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new Error(
      `O documento "${COLECAO}/${ID_ANTIGO}" tem o campo "data" ausente ou ` +
        `fora do formato AAAA-MM-DD (valor: ${JSON.stringify(data)}). ` +
        `Corrija no console do Firebase antes de rodar isto.`,
    );
  }

  const destino = colecao.doc(data);
  const jaExiste = await destino.get();
  if (jaExiste.exists) {
    throw new Error(
      `Já existe "${COLECAO}/${data}". Migrar sobrescreveria uma ordem montada ` +
        `no schema novo. Confira as duas no console do Firebase e apague ` +
        `"${COLECAO}/${ID_ANTIGO}" à mão se ele já não valer mais.`,
    );
  }

  await destino.set({ ...dados, id: data });
  await antigo.ref.delete();

  console.log(`Ordem migrada: ${COLECAO}/${ID_ANTIGO} → ${COLECAO}/${data}`);
}

async function main() {
  const db = getDb();
  console.log('Migrando a Ordem do Culto para uma ordem por data...');
  await migrarCulto(db);
  console.log('Migração concluída.');
}

main().catch((erro) => {
  console.error('Falha na migração:', erro);
  process.exit(1);
});

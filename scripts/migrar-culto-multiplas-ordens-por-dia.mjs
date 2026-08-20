// Migração pontual do Firestore: Ordem do Culto de "uma ordem por data"
// (`culto/{YYYY-MM-DD}`) para "múltiplas ordens por data" (`culto/{YYYY-MM-DD__HH:MM}`).
//
// NÃO É EXECUTADA AUTOMATICAMENTE. Rode manualmente uma vez, quando subir a
// versão que trabalha com mais de uma ordem no mesmo dia.
//
// Uso:
//   node scripts/migrar-culto-multiplas-ordens-por-dia.mjs
//
// Credencial: mesmo padrão de src/lib/firebase.ts — lê de
// FIREBASE_CREDENCIAIS_JSON (variável de ambiente) ou de
// segredos/firebase-admin.json (arquivo local, fora do git).
//
// O que este script faz:
//   1. Lê todos os documentos da coleção `culto`.
//   2. Para cada um cujo id NÃO contém "__" (formato antigo — só a data, ex:
//      "2026-08-23"): atribui `hora: "09:00"` (culto de domingo de manhã, o
//      caso mais comum), regrava o mesmo conteúdo em `culto/{data}__09:00`,
//      acrescenta `concluidoEm: null` (campo novo, ausente nos documentos
//      antigos), e apaga o documento antigo.
//   3. Documento cujo id já contém "__" (formato novo) é ignorado.
//
// Idempotente: rodar de novo depois de já ter migrado tudo não encontra mais
// nenhum documento no formato antigo, e portanto não faz nada. Se o destino
// `culto/{data}__09:00` já existir por algum motivo (não deveria — não havia
// como ter duas ordens no mesmo dia no schema antigo), o script pula aquele
// documento com um aviso em vez de sobrescrever, para não perder trabalho.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COLECAO = 'culto';
const HORA_PADRAO = '09:00';
const REGEX_ID_ANTIGO = /^\d{4}-\d{2}-\d{2}$/;

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

async function migrarCultos(db) {
  const colecao = db.collection(COLECAO);
  const snap = await colecao.get();

  const antigos = snap.docs.filter((doc) => REGEX_ID_ANTIGO.test(doc.id));

  if (antigos.length === 0) {
    console.log(
      `Nenhum documento no formato antigo (id só com a data) encontrado em ` +
        `"${COLECAO}" — nada a migrar.`,
    );
    return;
  }

  console.log(`${antigos.length} documento(s) no formato antigo encontrado(s).`);

  for (const doc of antigos) {
    const dados = doc.data();
    const dataAntiga = doc.id;
    const idNovo = `${dataAntiga}__${HORA_PADRAO}`;

    const destino = colecao.doc(idNovo);
    const jaExiste = await destino.get();
    if (jaExiste.exists) {
      console.warn(
        `Pulei "${COLECAO}/${dataAntiga}": já existe "${COLECAO}/${idNovo}" — ` +
          `confira as duas no console do Firebase antes de decidir o que fazer.`,
      );
      continue;
    }

    await destino.set({
      ...dados,
      id: idNovo,
      data: dados.data ?? dataAntiga,
      hora: HORA_PADRAO,
      concluidoEm: dados.concluidoEm ?? null,
    });
    await doc.ref.delete();

    console.log(`Migrado: ${COLECAO}/${dataAntiga} → ${COLECAO}/${idNovo}`);
  }
}

async function main() {
  const db = getDb();
  console.log('Migrando a Ordem do Culto para o schema de múltiplas ordens por dia...');
  await migrarCultos(db);
  console.log('Migração concluída.');
}

main().catch((erro) => {
  console.error('Falha na migração:', erro);
  process.exit(1);
});

// Migração pontual do Firestore: schema antigo (areas + mensagens com
// areaSlug/autor) → schema novo (departamentos + mensagens com
// conversaId/remetente).
//
// NÃO É EXECUTADA AUTOMATICAMENTE. Rode manualmente quando for migrar o
// Firestore de produção (o `.env.local` de desenvolvimento deste projeto usa
// COREDJA_STORAGE=firebase, mas ambientes locais em geral usam
// COREDJA_STORAGE=sqlite — confira o seu antes de rodar isto).
//
// Uso:
//   node scripts/migrar-mensagens-firestore.mjs
//
// Credencial: mesmo padrão de src/lib/firebase.ts — lê de
// FIREBASE_CREDENCIAIS_JSON (variável de ambiente) ou de
// segredos/firebase-admin.json (arquivo local, fora do git).
//
// O que este script faz:
//   1. Lê todos os documentos da coleção `mensagens` que ainda têm o campo
//      antigo `areaSlug` (schema pré-migração).
//   2. Para cada um, calcula conversaId (idDaConversa(areaSlug, 'audiovisual'))
//      e remetente (autor === 'area' ? areaSlug : 'audiovisual'), grava os
//      campos novos e remove os antigos (areaSlug, autor) com FieldValue.delete().
//   3. Cria os documentos da coleção `departamentos` — audiovisual + as áreas
//      que hoje vivem em src/lib/areas.ts — se ainda não existirem.
//
// Idempotente: documentos já migrados (sem `areaSlug`) são ignorados: rodar
// de novo não faz mal.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const AUDIOVISUAL_SLUG = 'audiovisual';

/** Mesmo algoritmo de idDaConversa em src/lib/conversas.ts. */
function idDaConversa(a, b) {
  return [a, b].sort().join('__');
}

/**
 * Departamentos a garantir. Espelha src/lib/areas.ts (áreas atuais) + o
 * audiovisual, que antes não era uma "área" cadastrada em lugar nenhum.
 * Se `areas.ts` ganhar itens novos antes desta migração rodar, atualize esta
 * lista também.
 */
const DEPARTAMENTOS_A_GARANTIR = [
  { slug: AUDIOVISUAL_SLUG, nome: 'Audiovisual', cor: '#6366f1' },
  { slug: 'cantina', nome: 'Cantina', cor: '#e07a3f' },
  { slug: 'kids', nome: 'Kids', cor: '#3f8fe0' },
];

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

async function migrarMensagens(db) {
  const snap = await db.collection('mensagens').get();

  let migradas = 0;
  let jaMigradas = 0;

  // Em lotes de 400 (limite do Firestore é 500 operações por batch) para não
  // estourar em coleções grandes.
  let lote = db.batch();
  let naLote = 0;

  for (const doc of snap.docs) {
    const dados = doc.data();

    if (!('areaSlug' in dados)) {
      jaMigradas++;
      continue;
    }

    const areaSlug = dados.areaSlug;
    const autor = dados.autor;
    const conversaId = idDaConversa(areaSlug, AUDIOVISUAL_SLUG);
    const remetente = autor === 'area' ? areaSlug : AUDIOVISUAL_SLUG;

    lote.update(doc.ref, {
      conversaId,
      remetente,
      areaSlug: FieldValue.delete(),
      autor: FieldValue.delete(),
    });
    naLote++;
    migradas++;

    if (naLote >= 400) {
      await lote.commit();
      lote = db.batch();
      naLote = 0;
    }
  }

  if (naLote > 0) await lote.commit();

  console.log(`Mensagens migradas: ${migradas}`);
  console.log(`Mensagens já no schema novo (ignoradas): ${jaMigradas}`);
}

async function garantirDepartamentos(db) {
  const colecao = db.collection('departamentos');
  let criados = 0;

  for (const departamento of DEPARTAMENTOS_A_GARANTIR) {
    const ref = colecao.doc(departamento.slug);
    const existente = await ref.get();
    if (existente.exists) continue;

    await ref.set({ nome: departamento.nome, cor: departamento.cor });
    criados++;
  }

  console.log(`Departamentos criados: ${criados}`);
}

async function main() {
  const db = getDb();
  console.log('Migrando coleção "mensagens"...');
  await migrarMensagens(db);
  console.log('Garantindo coleção "departamentos"...');
  await garantirDepartamentos(db);
  console.log('Migração concluída.');
}

main().catch((erro) => {
  console.error('Falha na migração:', erro);
  process.exit(1);
});

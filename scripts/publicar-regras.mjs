/**
 * Publica firestore.rules no projeto do Firebase.
 *
 *   node scripts/publicar-regras.mjs
 *
 * Faz o mesmo que colar o arquivo em Console → Firestore → Regras →
 * Publicar, usando a credencial de administrador de segredos/.
 *
 * Rode sempre que mudar firestore.rules — o arquivo no repositório não tem
 * efeito nenhum até ser publicado.
 */
import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
const cred = JSON.parse(readFileSync('./segredos/firebase-admin.json', 'utf8'));
const app = initializeApp({ credential: cert('./segredos/firebase-admin.json') });
const token = await app.options.credential.getAccessToken();
const PROJ = cred.project_id;
const H = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
const fonte = readFileSync('./firestore.rules', 'utf8');

// 1. Cria o ruleset.
let r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJ}/rulesets`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: fonte }] } }),
});
if (!r.ok) { console.error('erro ao criar ruleset:', r.status, await r.text()); process.exit(1); }
const { name } = await r.json();
console.log('ruleset criado:', name);

// 2. Aponta o release do Firestore para ele.
const release = `projects/${PROJ}/releases/cloud.firestore`;
r = await fetch(`https://firebaserules.googleapis.com/v1/${release}?updateMask=rulesetName`, {
  method: 'PATCH', headers: H,
  body: JSON.stringify({ release: { name: release, rulesetName: name } }),
});
if (!r.ok) {
  // Se ainda nao existe release, cria.
  r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJ}/releases`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: release, rulesetName: name }),
  });
}
if (!r.ok) { console.error('erro ao publicar:', r.status, await r.text()); process.exit(1); }
console.log('REGRAS PUBLICADAS no projeto', PROJ);
process.exit(0);

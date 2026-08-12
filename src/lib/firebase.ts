import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Conexão com o Cloud Firestore, do lado do servidor.
 *
 * Usa o SDK Admin, que ignora as regras de segurança do Firestore. É o que
 * permite manter a escrita fechada para todo mundo (`allow write: if false`):
 * nenhum recado entra no banco sem passar por aqui, e o link secreto de cada
 * área continua sendo conferido no servidor.
 *
 * A credencial vem de um de dois lugares, nesta ordem:
 *
 * 1. `FIREBASE_CREDENCIAIS_JSON` — o conteúdo do arquivo, como texto. É o
 *    caminho da plataforma hospedada, onde não existe disco para guardar
 *    arquivo e o segredo é cadastrado como variável de ambiente.
 *
 * 2. `segredos/firebase-admin.json` — o arquivo em disco, no .gitignore. É o
 *    caminho da instalação no PC do audiovisual.
 */

/** Erro de configuração, com instrução do que fazer. */
export class ErroDeConfiguracao extends Error {}

/** Pasta fixa onde a credencial mora. Está no .gitignore. */
const PASTA_SEGREDOS = path.join(process.cwd(), 'segredos');

/**
 * Caminho do arquivo de credencial.
 *
 * `FIREBASE_CREDENCIAIS` aceita apenas o nome do arquivo, não um caminho
 * completo: manter a pasta fixa permite ao build provar onde a leitura
 * acontece — sem isso ele inclui o projeto inteiro na saída por precaução —
 * e reforça que a credencial só pode viver na pasta protegida pelo
 * .gitignore.
 */
function caminhoDaCredencial(): string {
  const nome = path.basename(
    process.env.FIREBASE_CREDENCIAIS ?? 'firebase-admin.json',
  );
  return path.join(PASTA_SEGREDOS, nome);
}

interface Credencial {
  project_id: string;
  client_email: string;
  private_key: string;
}

/**
 * Lê a credencial da variável de ambiente ou do arquivo em `segredos/`.
 * Lança `ErroDeConfiguracao` com instrução do que fazer.
 */
function lerCredencial(): Credencial {
  const doAmbiente = process.env.FIREBASE_CREDENCIAIS_JSON;
  const caminho = caminhoDaCredencial();

  let bruto: string;
  let origem: string;

  if (doAmbiente && doAmbiente.trim()) {
    bruto = doAmbiente;
    origem = 'a variável FIREBASE_CREDENCIAIS_JSON';
  } else if (existsSync(caminho)) {
    bruto = readFileSync(caminho, 'utf8');
    origem = `o arquivo "${caminho}"`;
  } else {
    throw new ErroDeConfiguracao(
      'Credencial do Firebase não encontrada.\n\n' +
        'No PC: baixe em Console do Firebase → ⚙️ Configurações do projeto →\n' +
        'Contas de serviço → "Gerar nova chave privada", e salve como\n' +
        'segredos/firebase-admin.json.\n\n' +
        'Hospedado: cadastre o conteúdo desse arquivo na variável de ambiente\n' +
        'FIREBASE_CREDENCIAIS_JSON.\n\n' +
        'Para usar o armazenamento local, defina COREDJA_STORAGE=sqlite.',
    );
  }

  let credencial: Partial<Credencial>;
  try {
    credencial = JSON.parse(bruto);
  } catch {
    throw new ErroDeConfiguracao(
      `${origem} não contém um JSON válido. Baixe a chave de novo pelo ` +
        'Console do Firebase e cole o conteúdo inteiro, sem cortar nada.',
    );
  }

  if (!credencial.project_id || !credencial.private_key || !credencial.client_email) {
    throw new ErroDeConfiguracao(
      `${origem} não parece ser uma chave de conta de serviço. Confira se ` +
        'veio da aba "Contas de serviço" do Console do Firebase, e não de ' +
        'outro lugar.',
    );
  }

  return credencial as Credencial;
}

let instancia: Firestore | null = null;

/**
 * Devolve a conexão com o Firestore, criando-a na primeira chamada.
 *
 * Como em `db.ts`, a instância também fica em `globalThis` porque o Next
 * recarrega módulos em desenvolvimento e, sem isso, cada alteração de código
 * abriria uma conexão nova.
 */
export function getFirestoreDb(): Firestore {
  if (instancia) return instancia;

  const cache = globalThis as typeof globalThis & {
    __coredjaFirestore?: Firestore;
  };
  if (cache.__coredjaFirestore) {
    instancia = cache.__coredjaFirestore;
    return instancia;
  }

  const credencial = lerCredencial();

  // getApps() evita reinicializar o app do Firebase quando o Next recarrega.
  const app: App =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: credencial.project_id,
        clientEmail: credencial.client_email,
        // A chave costuma chegar com "\n" literal quando vem de variável de
        // ambiente (painéis de hospedagem não aceitam quebra de linha real).
        privateKey: credencial.private_key.replace(/\\n/g, '\n'),
      }),
      projectId: credencial.project_id,
    });

  const db = getFirestore(app);

  // Grava campos `undefined` como ausentes em vez de dar erro. Sem isso, um
  // campo opcional não preenchido derrubaria a escrita inteira.
  db.settings({ ignoreUndefinedProperties: true });

  instancia = db;
  cache.__coredjaFirestore = db;
  return instancia;
}

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Conexão com o Cloud Firestore.
 *
 * Usa o SDK Admin, que roda apenas no servidor e ignora as regras de
 * segurança do Firestore. É por isso que o banco pode ficar completamente
 * fechado (`allow read, write: if false`): ninguém chega nele pelo navegador,
 * e o link secreto de cada área continua sendo conferido aqui no servidor,
 * como sempre foi.
 *
 * A credencial vem do arquivo em `segredos/`, que está no .gitignore.
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

  const caminho = caminhoDaCredencial();

  if (!existsSync(caminho)) {
    throw new ErroDeConfiguracao(
      `Credencial do Firebase não encontrada em "${caminho}".\n\n` +
        'Baixe em: Console do Firebase → ⚙️ Configurações do projeto →\n' +
        'Contas de serviço → "Gerar nova chave privada".\n' +
        'Depois salve o arquivo como segredos/firebase-admin.json.\n\n' +
        'Para voltar ao armazenamento local, defina COREDJA_STORAGE=sqlite ' +
        'no arquivo .env.local.',
    );
  }

  let credencial: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  try {
    credencial = JSON.parse(readFileSync(caminho, 'utf8'));
  } catch {
    throw new ErroDeConfiguracao(
      `O arquivo "${caminho}" não é um JSON válido. Baixe a chave de novo ` +
        'pelo Console do Firebase.',
    );
  }

  if (!credencial.project_id || !credencial.private_key) {
    throw new ErroDeConfiguracao(
      `O arquivo "${caminho}" não parece ser uma chave de conta de serviço. ` +
        'Confira se baixou pela aba "Contas de serviço" do Console do ' +
        'Firebase, e não outro arquivo de configuração.',
    );
  }

  // getApps() evita reinicializar o app do Firebase quando o Next recarrega.
  const app: App =
    getApps()[0] ??
    initializeApp({
      credential: cert(caminho),
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

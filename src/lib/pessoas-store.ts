import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from './firebase';
import type { Papel, Pessoa } from './papeis';

/**
 * Operações sobre quem tem conta no Coredja — CRUD da coleção `pessoas` +
 * criação da conta de login em si (Firebase Authentication).
 *
 * Fica em arquivo próprio, fora de `papeis.ts`, porque `papeis.ts` é o
 * contrato (tipos + regra de permissão), sem tocar em nenhum SDK; este
 * arquivo é implementação — mesma separação de `culto.ts`/`culto-store.ts`.
 */

const COLECAO = 'pessoas';

function db() {
  return getFirestoreDb();
}

function auth() {
  db(); // garante que o app do Admin SDK já existe
  const app = getApps()[0];
  if (!app) throw new Error('Firebase Admin não inicializado.');
  return getAuth(app);
}

export interface NovaPessoa {
  nome: string;
  email: string;
  papel: Papel;
  departamento?: string;
  areasVisiveis: string[];
  /** Abas do menu. Ausente = o padrão do cargo (ver `abasDaPessoa`). */
  abas?: string[];
}

/** Uma pessoa recém-convidada, com a senha temporária que ela usa no primeiro login. */
export interface PessoaConvidada extends Pessoa {
  senhaTemporaria: string;
}

/**
 * Senha padrão de toda conta nova — igreja pequena, uso interno, prioridade
 * é simplicidade de convidar sobre força de senha. Mínimo aceito pelo
 * Firebase Auth é 6 caracteres; a pessoa pode trocar depois em "esqueci a
 * senha".
 */
const SENHA_PADRAO = '123456';

export const pessoasStore = {
  async listar(): Promise<Pessoa[]> {
    const snap = await db().collection(COLECAO).get();
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Pessoa);
  },

  /**
   * Cria a conta de login (se o e-mail ainda não existir no Authentication)
   * e a ficha em `pessoas`. Devolve a senha temporária uma única vez — ela
   * não fica salva em lugar nenhum depois disso; se perder, é preciso gerar
   * outra (ver `redefinirSenha`).
   */
  async convidar(dados: NovaPessoa): Promise<PessoaConvidada> {
    const senhaTemporaria = SENHA_PADRAO;

    let usuario;
    try {
      usuario = await auth().getUserByEmail(dados.email);
    } catch {
      usuario = await auth().createUser({
        email: dados.email,
        password: senhaTemporaria,
        displayName: dados.nome,
      });
    }

    const pessoa: Omit<Pessoa, 'uid'> = {
      nome: dados.nome,
      email: dados.email,
      papel: dados.papel,
      departamento: dados.departamento,
      areasVisiveis: dados.areasVisiveis,
      // Só grava quando o admin escolheu algo: ausente significa "o padrão do
      // cargo", e gravar a lista padrão congelaria o menu desta pessoa se o
      // padrão mudar depois.
      ...(dados.abas ? { abas: dados.abas } : {}),
    };
    await db().collection(COLECAO).doc(usuario.uid).set(pessoa);

    return { uid: usuario.uid, ...pessoa, senhaTemporaria };
  },

  async atualizar(
    uid: string,
    dados: {
      papel: Papel;
      departamento?: string;
      areasVisiveis: string[];
      abas?: string[] | null;
    },
  ): Promise<void> {
    await db()
      .collection(COLECAO)
      .doc(uid)
      .update({
        papel: dados.papel,
        departamento: dados.departamento,
        areasVisiveis: dados.areasVisiveis,
        // `null` apaga o campo e devolve a pessoa ao padrão do cargo —
        // `undefined` seria ignorado pelo Firestore, deixando a escolha
        // antiga gravada para sempre.
        ...(dados.abas === undefined
          ? {}
          : { abas: dados.abas === null ? FieldValue.delete() : dados.abas }),
      });
  },

  /** Remove a ficha em `pessoas` — a pessoa perde acesso ao Coredja, mas a
   *  conta de login em si permanece (pode ser convidada de novo depois). */
  async remover(uid: string): Promise<void> {
    await db().collection(COLECAO).doc(uid).delete();
  },
};

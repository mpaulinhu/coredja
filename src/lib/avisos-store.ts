import { getFirestoreDb } from './firebase';
import { normalizarAviso, type Aviso, type NovoAviso, type StoreAvisos } from './avisos';

/**
 * Implementação de `StoreAvisos` sobre o Cloud Firestore.
 *
 * Mesma decisão de `culto-store.ts`: sem versão SQLite, porque cadastrar na
 * semana e publicar no domingo só faz sentido com a plataforma publicada.
 */

const COLECAO = 'avisos';

function colecao() {
  return getFirestoreDb().collection(COLECAO);
}

export const avisosStore: StoreAvisos = {
  async listar() {
    const snap = await colecao().get();
    return snap.docs
      .map((d) => normalizarAviso({ id: d.id, ...d.data() }))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  },

  async buscar(id: string) {
    const doc = await colecao().doc(id).get();
    if (!doc.exists) return null;
    return normalizarAviso({ id: doc.id, ...doc.data() });
  },

  async criar(dados: NovoAviso, autor: string) {
    // `imagem` só entra no documento quando existe: o Firestore recusa
    // `undefined` como valor de campo.
    const doc: Omit<Aviso, 'id'> = {
      titulo: dados.titulo,
      texto: dados.texto,
      ...(dados.imagem ? { imagem: dados.imagem } : {}),
      dias: dados.dias,
      noAr: false,
      criadoPor: autor,
      criadoEm: new Date().toISOString(),
    };
    const ref = await colecao().add(doc);
    return { id: ref.id, ...doc };
  },

  async remover(id: string) {
    await colecao().doc(id).delete();
  },

  async publicar(id: string) {
    const db = getFirestoreDb();
    // Transação: ler quem está no ar e trocar num único lote atômico. Duas
    // escritas soltas (apaga o antigo, marca o novo) deixariam uma janela em
    // que dois avisos — ou nenhum — estão no ar, se algo falhar no meio.
    await db.runTransaction(async (tx) => {
      const noArAntes = await tx.get(colecao().where('noAr', '==', true));
      noArAntes.docs.forEach((doc) => tx.update(doc.ref, { noAr: false }));
      tx.update(colecao().doc(id), { noAr: true });
    });
    return this.listar();
  },

  async ocultar(id: string) {
    await colecao().doc(id).update({ noAr: false });
    return this.listar();
  },
};

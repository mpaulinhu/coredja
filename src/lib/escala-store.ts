import { getFirestoreDb } from './firebase';
import type { Escala, NovaEscala, StoreEscala } from './escala';

/**
 * Implementação de `StoreEscala` sobre o Cloud Firestore. Mesmo padrão de
 * `culto-store.ts`: documento único, sem versão SQLite — só faz sentido com
 * a plataforma publicada.
 */

const COLECAO = 'escala';
const ID_DOCUMENTO = 'atual';

function ref() {
  return getFirestoreDb().collection(COLECAO).doc(ID_DOCUMENTO);
}

export const escalaStore: StoreEscala = {
  async buscar() {
    const doc = await ref().get();
    return doc.exists ? (doc.data() as Escala) : null;
  },

  async salvar(dados: NovaEscala, autor: string) {
    const escala: Escala = {
      data: dados.data,
      // Uma edição nova zera as confirmações de presença: elas pertenciam à
      // lista de pessoas anterior, que pode ter mudado.
      escalados: dados.escalados.map((e) => ({ ...e, presente: false })),
      editadoPor: autor,
      editadoEm: new Date().toISOString(),
    };
    await ref().set(escala);
    return escala;
  },

  async marcarPresenca(id: string, presente: boolean) {
    const doc = await ref().get();
    if (!doc.exists) return null;
    const escala = doc.data() as Escala;

    const atualizado: Escala = {
      ...escala,
      escalados: escala.escalados.map((e) => (e.id === id ? { ...e, presente } : e)),
    };
    await ref().set(atualizado);
    return atualizado;
  },
};

import { getFirestoreDb } from './firebase';
import type { Bloco, Culto, NovoCulto, StoreCulto } from './culto';

/**
 * Implementação de `StoreCulto` sobre o Cloud Firestore.
 *
 * Ao contrário dos recados (`store.ts`), esta tela não tem versão SQLite:
 * a Ordem do Culto só existe para ser preparada na semana por uma pessoa e
 * lida por outra no domingo — sem publicação, isso não tem uso. Ver a nota em
 * `culto.ts` sobre a plataforma deixar de ser local.
 */

const COLECAO = 'culto';
const ID_DOCUMENTO = 'atual';

function ref() {
  return getFirestoreDb().collection(COLECAO).doc(ID_DOCUMENTO);
}

export const cultoStore: StoreCulto = {
  async buscar() {
    const doc = await ref().get();
    return doc.exists ? (doc.data() as Culto) : null;
  },

  async salvar(dados: NovoCulto, autor: string) {
    const culto: Culto = {
      data: dados.data,
      blocos: dados.blocos,
      // Uma edição nova sempre reinicia a execução: o que estava "em
      // andamento" pertencia à sequência antiga, que pode ter mudado de
      // ordem ou perdido blocos.
      blocoAtualId: null,
      editadoPor: autor,
      editadoEm: new Date().toISOString(),
    };
    await ref().set(culto);
    return culto;
  },

  async avancar() {
    const doc = await ref().get();
    if (!doc.exists) return null;
    const culto = doc.data() as Culto;

    const indiceAtual = culto.blocos.findIndex((b) => b.id === culto.blocoAtualId);
    const proximo: Bloco | undefined =
      indiceAtual === -1 ? culto.blocos[0] : culto.blocos[indiceAtual + 1];

    const atualizado: Culto = { ...culto, blocoAtualId: proximo?.id ?? null };
    await ref().set(atualizado);
    return atualizado;
  },

  async reiniciar() {
    const doc = await ref().get();
    if (!doc.exists) return null;
    const culto = doc.data() as Culto;

    const atualizado: Culto = { ...culto, blocoAtualId: null };
    await ref().set(atualizado);
    return atualizado;
  },
};

import { getFirestoreDb } from './firebase';
import { hojeLocal, type Bloco, type Culto, type NovoCulto, type StoreCulto } from './culto';

/**
 * Implementação de `StoreCulto` sobre o Cloud Firestore.
 *
 * Ao contrário dos recados (`store.ts`), esta tela não tem versão SQLite:
 * a Ordem do Culto só existe para ser preparada na semana por uma pessoa e
 * lida por outra no domingo — sem publicação, isso não tem uso. Ver a nota em
 * `culto.ts` sobre a plataforma deixar de ser local.
 *
 * A coleção guarda uma ordem por data, com o id do documento sendo a própria
 * data — ver `culto.ts`.
 */

const COLECAO = 'culto';

function colecao() {
  return getFirestoreDb().collection(COLECAO);
}

/**
 * A igreja não tem centenas de cultos: ler a coleção inteira e ordenar em
 * memória é mais simples que manter índice e paginação, e evita um `orderBy`
 * que quebraria com os documentos legados sem o campo `id`.
 *
 * Ignora documento sem `data` no formato esperado: a coleção pode conter
 * sobras que não são cultos (um `_teste_regras` acabou ficando lá, por
 * exemplo), e uma sobra dessas não pode derrubar a tela inteira.
 */
async function todos(): Promise<Culto[]> {
  const snap = await colecao().get();
  return snap.docs
    .map((doc) => ({ ...(doc.data() as Culto), id: doc.id }))
    .filter((culto) => /^\d{4}-\d{2}-\d{2}$/.test(culto.data ?? ''))
    .sort((a, b) => a.data.localeCompare(b.data));
}

export const cultoStore: StoreCulto = {
  listar: todos,

  async buscar(id: string) {
    const doc = await colecao().doc(id).get();
    return doc.exists ? ({ ...(doc.data() as Culto), id: doc.id }) : null;
  },

  async buscarAtiva() {
    const hoje = hojeLocal();
    // Datas em "YYYY-MM-DD" comparam certo como texto, então a primeira da
    // lista ordenada que não ficou no passado é a de hoje ou a próxima futura.
    return (await todos()).find((culto) => culto.data >= hoje) ?? null;
  },

  async salvar(dados: NovoCulto, autor: string) {
    const culto: Culto = {
      id: dados.data,
      data: dados.data,
      blocos: dados.blocos,
      // Uma edição nova sempre reinicia a execução: o que estava "em
      // andamento" pertencia à sequência antiga, que pode ter mudado de
      // ordem ou perdido blocos.
      blocoAtualId: null,
      editadoPor: autor,
      editadoEm: new Date().toISOString(),
    };
    await colecao().doc(culto.id).set(culto);
    return culto;
  },

  async remover(id: string) {
    await colecao().doc(id).delete();
  },

  async avancar(id: string) {
    const ref = colecao().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const culto = { ...(doc.data() as Culto), id: doc.id };

    const indiceAtual = culto.blocos.findIndex((b) => b.id === culto.blocoAtualId);
    const proximo: Bloco | undefined =
      indiceAtual === -1 ? culto.blocos[0] : culto.blocos[indiceAtual + 1];

    const atualizado: Culto = { ...culto, blocoAtualId: proximo?.id ?? null };
    await ref.set(atualizado);
    return atualizado;
  },

  async reiniciar(id: string) {
    const ref = colecao().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const culto = { ...(doc.data() as Culto), id: doc.id };

    const atualizado: Culto = { ...culto, blocoAtualId: null };
    await ref.set(atualizado);
    return atualizado;
  },
};

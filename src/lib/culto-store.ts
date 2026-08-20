import { getFirestoreDb } from './firebase';
import {
  hojeLocal,
  horaLocal,
  idDoCulto,
  type Bloco,
  type Culto,
  type ModeloCulto,
  type NovoCulto,
  type NovoModelo,
  type StoreCulto,
} from './culto';

/**
 * Implementação de `StoreCulto` sobre o Cloud Firestore.
 *
 * Ao contrário dos recados (`store.ts`), esta tela não tem versão SQLite:
 * a Ordem do Culto só existe para ser preparada na semana por uma pessoa e
 * lida por outra no domingo — sem publicação, isso não tem uso. Ver a nota em
 * `culto.ts` sobre a plataforma deixar de ser local.
 *
 * A coleção guarda uma ordem por data+hora, com o id do documento sendo
 * `"{data}__{hora}"` — ver `culto.ts`.
 */

const COLECAO = 'culto';
const COLECAO_MODELOS = 'culto_modelos';

function colecao() {
  return getFirestoreDb().collection(COLECAO);
}

function colecaoModelos() {
  return getFirestoreDb().collection(COLECAO_MODELOS);
}

/** Formato válido do id atual: `"YYYY-MM-DD__HH:MM"`. */
const REGEX_ID = /^\d{4}-\d{2}-\d{2}__\d{2}:\d{2}$/;

/**
 * A igreja não tem centenas de cultos: ler a coleção inteira e ordenar em
 * memória é mais simples que manter índice e paginação, e evita um `orderBy`
 * que quebraria com os documentos legados sem os campos `hora`/`concluidoEm`.
 *
 * Ignora documento cujo id não está no formato novo (`data__hora`): a
 * migração (`scripts/migrar-culto-multiplas-ordens.mjs`) precisa rodar antes
 * de um documento antigo (id só com a data) aparecer aqui — enquanto isso não
 * acontece, uma sobra no formato velho não pode derrubar a tela inteira.
 */
async function todos(): Promise<Culto[]> {
  const snap = await colecao().get();
  return snap.docs
    .map((doc) => ({ ...(doc.data() as Culto), id: doc.id }))
    .filter((culto) => REGEX_ID.test(culto.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export const cultoStore: StoreCulto = {
  listar: todos,

  async buscar(id: string) {
    const doc = await colecao().doc(id).get();
    return doc.exists ? ({ ...(doc.data() as Culto), id: doc.id }) : null;
  },

  async buscarAtiva() {
    const hoje = hojeLocal();
    const agora = horaLocal();

    const lista = await todos();
    const deHoje = lista.filter((c) => c.data === hoje && !c.concluidoEm);

    if (deHoje.length > 0) {
      // Entre as de hoje ainda abertas, a de horário mais próximo do agora —
      // não necessariamente a mais tarde nem a mais cedo: se já passaram das
      // 20h e há uma às 09h (encerrada) e uma às 19h (não concluída), a das
      // 19h é a que está "no ar" mesmo que já tenha ultrapassado o horário.
      return deHoje.reduce((maisProxima, atual) =>
        distanciaMinutos(atual.hora, agora) < distanciaMinutos(maisProxima.hora, agora)
          ? atual
          : maisProxima,
      );
    }

    // Nenhuma hoje (ou todas concluídas): a próxima futura, ignorando
    // concluídas — uma ordem de amanhã concluída de propósito não deveria
    // aparecer como "ativa" antes da hora.
    return (
      lista.find((c) => c.data > hoje && !c.concluidoEm) ?? null
    );
  },

  async salvar(dados: NovoCulto, autor: string) {
    const id = idDoCulto(dados.data, dados.hora);
    const culto: Culto = {
      id,
      data: dados.data,
      hora: dados.hora,
      blocos: dados.blocos,
      // Uma edição nova sempre reinicia a execução: o que estava "em
      // andamento" pertencia à sequência antiga, que pode ter mudado de
      // ordem ou perdido blocos.
      blocoAtualId: null,
      concluidoEm: null,
      editadoPor: autor,
      editadoEm: new Date().toISOString(),
    };
    await colecao().doc(id).set(culto);
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

  async concluir(id: string, concluir: boolean) {
    const ref = colecao().doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const culto = { ...(doc.data() as Culto), id: doc.id };

    const atualizado: Culto = {
      ...culto,
      concluidoEm: concluir ? new Date().toISOString() : null,
    };
    await ref.set(atualizado);
    return atualizado;
  },

  async listarModelos() {
    const snap = await colecaoModelos().get();
    return snap.docs
      .map((doc) => ({ ...(doc.data() as ModeloCulto), id: doc.id }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  async salvarModelo(dados: NovoModelo, autor: string) {
    const ref = colecaoModelos().doc();
    const modelo: ModeloCulto = {
      id: ref.id,
      nome: dados.nome,
      blocos: dados.blocos,
      criadoPor: autor,
      criadoEm: new Date().toISOString(),
    };
    await ref.set(modelo);
    return modelo;
  },

  async removerModelo(id: string) {
    await colecaoModelos().doc(id).delete();
  },
};

/** Distância em minutos entre dois horários `"HH:MM"`, sempre positiva. */
function distanciaMinutos(a: string, b: string): number {
  const [ha, ma] = a.split(':').map(Number);
  const [hb, mb] = b.split(':').map(Number);
  return Math.abs(ha * 60 + ma - (hb * 60 + mb));
}

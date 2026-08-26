import type { Firestore } from 'firebase-admin/firestore';
import { AUDIOVISUAL_SLUG } from './conversa-compartilhado';
import { getFirestoreDb } from './firebase';
import type {
  ConversaComMensagem,
  Departamento,
  Mensagem,
  NovaMensagem,
  Store,
} from './types';

/**
 * Implementação de `Store` sobre o Cloud Firestore.
 *
 * Espelha `sqlite-store.ts` operação por operação. A escolha entre os dois
 * acontece em `store.ts`, e nenhuma tela sabe qual está em uso.
 *
 * Duas diferenças de modelagem em relação ao SQLite valem nota:
 *
 * 1. Os anexos ficam dentro do próprio documento da mensagem, não numa
 *    coleção separada. No Firestore cada leitura de documento é cobrada, e
 *    guardar junto evita uma segunda consulta por mensagem. São no máximo 4
 *    anexos pequenos, bem abaixo do limite de 1 MB por documento.
 *
 * 2. Toda ordenação acontece em memória, nunca no banco. O Firestore exige um
 *    índice composto, criado à mão no Console, para qualquer consulta que
 *    filtre por um campo e ordene por outro — e cada consulta dessas seria
 *    mais um passo manual para quem instalar isso numa igreja. Com dezenas ou
 *    centenas de recados, ordenar em memória é instantâneo e não custa nada.
 *    Se um dia o volume crescer muito, aí sim vale criar os índices.
 *
 * Diferente do modelo antigo (onde `AREAS` de `areas.ts` era a fonte da
 * verdade, e a coleção `areas` só um espelho para o navegador ler), a
 * coleção `departamentos` agora É a fonte da verdade — o CRUD de
 * Departamentos (Etapa 4, fora do escopo desta migração) escreve direto nela.
 */

const COLECAO_DEPARTAMENTOS = 'departamentos';
const COLECAO_MENSAGENS = 'mensagens';

/** Departamentos semeados na primeira execução, se a coleção estiver vazia. */
const DEPARTAMENTOS_INICIAIS: Departamento[] = [
  { slug: AUDIOVISUAL_SLUG, nome: 'Audiovisual', cor: '#6366f1' },
  { slug: 'cantina', nome: 'Cantina', cor: '#e07a3f' },
  { slug: 'kids', nome: 'Kids', cor: '#3f8fe0' },
];

/** Formato do documento de mensagem no Firestore. */
interface DocMensagem {
  conversaId: string;
  remetente: string;
  /** Ausente em recado gravado antes do campo existir — ver `Mensagem.autor`. */
  autor?: string;
  texto: string;
  prioridade: Mensagem['prioridade'];
  criadaEm: string;
  resolvidaEm: string | null;
  anexos: Mensagem['anexos'];
}

function db(): Firestore {
  return getFirestoreDb();
}

/**
 * Garante que os departamentos iniciais existam, sem sobrescrever o que já
 * foi editado pelo CRUD (Etapa 4). Roda uma vez por processo.
 */
let semeadura: Promise<void> | null = null;

async function garantirSemeadura(): Promise<void> {
  // Guarda a promessa, não um booleano: se duas requisições chegarem juntas
  // na primeira vez, ambas esperam a mesma escrita em vez de disparar duas.
  if (!semeadura) {
    semeadura = (async () => {
      const colecao = db().collection(COLECAO_DEPARTAMENTOS);
      const lote = db().batch();
      for (const departamento of DEPARTAMENTOS_INICIAIS) {
        const ref = colecao.doc(departamento.slug);
        const existente = await ref.get();
        if (!existente.exists) {
          lote.set(ref, { nome: departamento.nome, cor: departamento.cor });
        }
      }
      await lote.commit();
    })().catch((erro) => {
      // Uma falha (rede caída, por exemplo) não pode marcar a semeadura como
      // feita para sempre — zera para a próxima requisição tentar de novo.
      semeadura = null;
      throw erro;
    });
  }
  return semeadura;
}

function paraDepartamento(
  slug: string,
  dados: FirebaseFirestore.DocumentData,
): Departamento {
  return { slug, nome: dados.nome, cor: dados.cor };
}

/** Converte um documento do Firestore para o formato usado nas telas. */
function paraMensagem(
  id: string,
  dados: FirebaseFirestore.DocumentData,
): Mensagem {
  const doc = dados as DocMensagem;
  return {
    id,
    conversaId: doc.conversaId,
    remetente: doc.remetente,
    autor: doc.autor,
    texto: doc.texto,
    prioridade: doc.prioridade ?? null,
    criadaEm: doc.criadaEm,
    resolvidaEm: doc.resolvidaEm ?? null,
    anexos: doc.anexos ?? [],
  };
}

export const firebaseStore: Store = {
  async listarDepartamentos() {
    await garantirSemeadura();
    const snap = await db().collection(COLECAO_DEPARTAMENTOS).get();
    return snap.docs
      .map((d) => paraDepartamento(d.id, d.data()))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  },

  async buscarDepartamento(slug) {
    await garantirSemeadura();
    const doc = await db().collection(COLECAO_DEPARTAMENTOS).doc(slug).get();
    return doc.exists ? paraDepartamento(doc.id, doc.data()!) : null;
  },

  async criarDepartamento(dados) {
    await garantirSemeadura();
    await db()
      .collection(COLECAO_DEPARTAMENTOS)
      .doc(dados.slug)
      .set({ nome: dados.nome, cor: dados.cor });
    return dados;
  },

  async atualizarDepartamento(slug, dados) {
    await garantirSemeadura();
    const ref = db().collection(COLECAO_DEPARTAMENTOS).doc(slug);
    const existente = await ref.get();
    if (!existente.exists) return null;

    await ref.update({ nome: dados.nome, cor: dados.cor });
    return { slug, ...dados };
  },

  async removerDepartamento(slug) {
    await garantirSemeadura();
    await db().collection(COLECAO_DEPARTAMENTOS).doc(slug).delete();
  },

  async criarMensagem(dados: NovaMensagem) {
    await garantirSemeadura();

    const criadaEm = new Date().toISOString();
    const doc: DocMensagem = {
      conversaId: dados.conversaId,
      remetente: dados.remetente,
      // Só entra no documento quando existe: o Firestore recusa `undefined`.
      ...(dados.autor ? { autor: dados.autor } : {}),
      texto: dados.texto,
      prioridade: dados.prioridade,
      criadaEm,
      resolvidaEm: null,
      // O id de cada anexo é gerado aqui para o formato bater com o do SQLite,
      // onde ele vem do banco.
      anexos: dados.anexos.map((anexo, indice) => ({
        ...anexo,
        id: `${criadaEm}-${indice}`,
      })),
    };

    const ref = await db().collection(COLECAO_MENSAGENS).add(doc);
    return paraMensagem(ref.id, doc);
  },

  async listarPendentes() {
    await garantirSemeadura();
    const snap = await db()
      .collection(COLECAO_MENSAGENS)
      .where('resolvidaEm', '==', null)
      .get();

    // A ordenação acontece aqui, não no Firestore. Ordenar por dois campos no
    // banco exigiria criar um índice composto no Console — um passo manual a
    // mais para quem for instalar isso. Com dezenas de recados pendentes, o
    // custo de ordenar em memória é irrelevante.
    return snap.docs
      .map((d) => paraMensagem(d.id, d.data()))
      .sort((a, b) => {
        if (a.prioridade !== b.prioridade) {
          return a.prioridade === 'urgente' ? -1 : 1;
        }
        return b.criadaEm.localeCompare(a.criadaEm);
      });
  },

  async listarHistorico(limite = 100) {
    await garantirSemeadura();
    // Filtra por um campo e ordena por outro em memória, como em
    // `listarPendentes` — ver a nota sobre índices compostos ali.
    const snap = await db()
      .collection(COLECAO_MENSAGENS)
      .where('resolvidaEm', '!=', null)
      .get();

    return snap.docs
      .map((d) => paraMensagem(d.id, d.data()))
      .sort((a, b) => (b.resolvidaEm ?? '').localeCompare(a.resolvidaEm ?? ''))
      .slice(0, limite);
  },

  async listarPorConversa(conversaId, limite = 50) {
    await garantirSemeadura();
    const snap = await db()
      .collection(COLECAO_MENSAGENS)
      .where('conversaId', '==', conversaId)
      .get();

    // Ordena da mais recente para a mais antiga, corta no limite, e então
    // inverte: a conversa é lida de cima para baixo, como num aplicativo de
    // mensagem.
    return snap.docs
      .map((d) => paraMensagem(d.id, d.data()))
      .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
      .slice(0, limite)
      .reverse();
  },

  async listarConversasComMensagem() {
    await garantirSemeadura();
    // Agrupa em memória por conversaId — mesmo padrão já usado neste arquivo
    // para evitar índice composto. deptoA/deptoB vêm de dar split no id
    // (construído por idDaConversa como "a__b", já ordenado).
    const snap = await db().collection(COLECAO_MENSAGENS).get();

    const porConversa = new Map<string, ConversaComMensagem>();
    for (const doc of snap.docs) {
      const conversaId = (doc.data() as DocMensagem).conversaId;
      if (porConversa.has(conversaId)) continue;

      const [deptoA, deptoB] = conversaId.split('__');
      porConversa.set(conversaId, { conversaId, deptoA, deptoB: deptoB ?? deptoA });
    }

    return [...porConversa.values()];
  },

  async buscarMensagem(id) {
    await garantirSemeadura();
    const doc = await db().collection(COLECAO_MENSAGENS).doc(id).get();
    if (!doc.exists) return null;
    return paraMensagem(doc.id, doc.data()!);
  },

  async resolverMensagem(id) {
    await garantirSemeadura();
    const ref = db().collection(COLECAO_MENSAGENS).doc(id);
    const antes = await ref.get();
    if (!antes.exists) return null;

    await ref.update({ resolvidaEm: new Date().toISOString() });
    const depois = await ref.get();
    return paraMensagem(depois.id, depois.data()!);
  },

  async reabrirMensagem(id) {
    await garantirSemeadura();
    const ref = db().collection(COLECAO_MENSAGENS).doc(id);
    const antes = await ref.get();
    if (!antes.exists) return null;

    await ref.update({ resolvidaEm: null });
    const depois = await ref.get();
    return paraMensagem(depois.id, depois.data()!);
  },

  async apagarMensagem(id) {
    await garantirSemeadura();
    await db().collection(COLECAO_MENSAGENS).doc(id).delete();
  },

  async apagarConversa(conversaId) {
    await garantirSemeadura();
    const snap = await db()
      .collection(COLECAO_MENSAGENS)
      .where('conversaId', '==', conversaId)
      .get();
    return apagarEmLotes(snap.docs.map((d) => d.ref));
  },

  async apagarResolvidosAntigos(dias) {
    await garantirSemeadura();
    const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

    // `resolvidaEm` guarda ISO 8601, que ordena igual como texto — então o
    // `<` compara datas corretamente sem conversão. Recado pendente tem o
    // campo `null` e não entra na consulta, que é justamente o que se quer.
    const snap = await db()
      .collection(COLECAO_MENSAGENS)
      .where('resolvidaEm', '<', limite)
      .get();
    return apagarEmLotes(snap.docs.map((d) => d.ref));
  },
};

/**
 * Apaga em lotes de 500 — o teto de operações por batch do Firestore.
 *
 * Uma conversa de meses de culto passa disso com folga, e um batch acima do
 * limite falha inteiro, sem apagar nada.
 */
async function apagarEmLotes(
  refs: FirebaseFirestore.DocumentReference[],
): Promise<number> {
  const TAMANHO = 500;
  for (let i = 0; i < refs.length; i += TAMANHO) {
    const lote = db().batch();
    refs.slice(i, i + TAMANHO).forEach((ref) => lote.delete(ref));
    await lote.commit();
  }
  return refs.length;
}

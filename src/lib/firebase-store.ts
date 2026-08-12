import type { Firestore } from 'firebase-admin/firestore';
import { AREAS } from './areas';
import { getFirestoreDb } from './firebase';
import type { Area, Mensagem, NovaMensagem, Store } from './types';

/**
 * Implementação de `Store` sobre o Cloud Firestore.
 *
 * Espelha `sqlite-store.ts` operação por operação. A escolha entre os dois
 * acontece em `store.ts`, e nenhuma tela sabe qual está em uso.
 *
 * Três diferenças de modelagem em relação ao SQLite valem nota:
 *
 * 1. Os anexos ficam dentro do próprio documento da mensagem, não numa
 *    coleção separada. No Firestore cada leitura de documento é cobrada, e
 *    guardar junto evita uma segunda consulta por mensagem. São no máximo 4
 *    anexos pequenos, bem abaixo do limite de 1 MB por documento.
 *
 * 2. Não há JOIN. Onde o SQL cruzava tabelas, aqui a leitura é direta — o que
 *    na prática deixa o código mais simples, não mais complexo.
 *
 * 3. Toda ordenação acontece em memória, nunca no banco. O Firestore exige um
 *    índice composto, criado à mão no Console, para qualquer consulta que
 *    filtre por um campo e ordene por outro — e cada consulta dessas seria
 *    mais um passo manual para quem instalar isso numa igreja. Com dezenas ou
 *    centenas de recados, ordenar em memória é instantâneo e não custa nada.
 *    Se um dia o volume crescer muito, aí sim vale criar os índices.
 */

const COLECAO_AREAS = 'areas';
const COLECAO_MENSAGENS = 'mensagens';

/** Formato do documento de mensagem no Firestore. */
interface DocMensagem {
  areaSlug: string;
  autor: Mensagem['autor'];
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
 * Grava no Firestore as áreas definidas em `areas.ts`.
 *
 * Como no SQLite, o código é a fonte da verdade: trocar um token vazado é
 * editar o arquivo e reiniciar. Roda uma vez por processo.
 */
let semeadura: Promise<void> | null = null;

async function garantirSemeadura(): Promise<void> {
  // Guarda a promessa, não um booleano: se duas requisições chegarem juntas
  // na primeira vez, ambas esperam a mesma escrita em vez de disparar duas.
  if (!semeadura) {
    semeadura = (async () => {
      const lote = db().batch();
      for (const area of AREAS) {
        lote.set(db().collection(COLECAO_AREAS).doc(area.slug), area);
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

/** Converte um documento do Firestore para o formato usado nas telas. */
function paraMensagem(
  id: string,
  dados: FirebaseFirestore.DocumentData,
): Mensagem {
  const doc = dados as DocMensagem;
  return {
    id,
    areaSlug: doc.areaSlug,
    autor: doc.autor,
    texto: doc.texto,
    prioridade: doc.prioridade,
    criadaEm: doc.criadaEm,
    resolvidaEm: doc.resolvidaEm ?? null,
    anexos: doc.anexos ?? [],
  };
}

export const firebaseStore: Store = {
  async listarAreas() {
    await garantirSemeadura();
    const snap = await db().collection(COLECAO_AREAS).orderBy('nome').get();

    // Se a coleção sumiu (limpeza manual, por exemplo), devolve o que está em
    // areas.ts em vez de deixar o painel sem nenhuma área. O código é a fonte
    // da verdade; o banco é só onde ele foi copiado.
    if (snap.empty) {
      return [...AREAS].sort((a, b) => a.nome.localeCompare(b.nome));
    }

    return snap.docs.map((d) => d.data() as Area);
  },

  async buscarArea(slug) {
    await garantirSemeadura();
    const ref = db().collection(COLECAO_AREAS).doc(slug);
    const doc = await ref.get();
    if (doc.exists) return doc.data() as Area;

    // A área está em areas.ts mas não no banco: alguém limpou a coleção, ou a
    // semeadura falhou. Regrava a partir do código, que é a fonte da verdade,
    // em vez de recusar o acesso e exigir reiniciar o servidor.
    const doCodigo = AREAS.find((a) => a.slug === slug);
    if (!doCodigo) return null;

    await ref.set(doCodigo);
    return doCodigo;
  },

  async autenticarArea(slug, token) {
    const area = await this.buscarArea(slug);
    // Confere o token aqui, no servidor. O Firestore em si continua fechado
    // para qualquer acesso vindo do navegador.
    return area && area.token === token ? area : null;
  },

  async criarMensagem(dados: NovaMensagem) {
    await garantirSemeadura();

    const criadaEm = new Date().toISOString();
    const doc: DocMensagem = {
      areaSlug: dados.areaSlug,
      autor: dados.autor,
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

  async listarPorArea(areaSlug, limite = 50) {
    await garantirSemeadura();
    const snap = await db()
      .collection(COLECAO_MENSAGENS)
      .where('areaSlug', '==', areaSlug)
      .get();

    // Ordena da mais recente para a mais antiga, corta no limite, e então
    // inverte: a área lê a conversa de cima para baixo, como num aplicativo
    // de mensagem.
    return snap.docs
      .map((d) => paraMensagem(d.id, d.data()))
      .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
      .slice(0, limite)
      .reverse();
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
};

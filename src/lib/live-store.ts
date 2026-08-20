import { FieldValue } from 'firebase-admin/firestore';
import { getFirestoreDb } from './firebase';
import {
  normalizarMensagemDaLive,
  type MensagemDaLive,
  type NovaMensagemDaLive,
  type StoreMensagensDaLive,
} from './live';

/**
 * Implementação de `StoreMensagensDaLive` sobre o Cloud Firestore.
 *
 * Mesma decisão de `avisos-store.ts` e `culto-store.ts`: sem versão SQLite.
 * Uma biblioteca de mensagens que só serve durante a transmissão pressupõe a
 * plataforma publicada — se a internet caiu, não há live para operar.
 */

const COLECAO = 'mensagens_live';

function colecao() {
  return getFirestoreDb().collection(COLECAO);
}

export const mensagensDaLiveStore: StoreMensagensDaLive = {
  async listar() {
    const snap = await colecao().get();
    return snap.docs.map((d) => normalizarMensagemDaLive({ id: d.id, ...d.data() }));
  },

  async criar(dados: NovaMensagemDaLive, autor: string) {
    const doc: Omit<MensagemDaLive, 'id'> = {
      texto: dados.texto,
      categoria: dados.categoria,
      vezesCopiada: 0,
      criadaPor: autor,
      criadaEm: new Date().toISOString(),
    };
    const ref = await colecao().add(doc);
    return { id: ref.id, ...doc };
  },

  async atualizar(id: string, dados: NovaMensagemDaLive) {
    const ref = colecao().doc(id);
    const antes = await ref.get();
    if (!antes.exists) return null;

    // `vezesCopiada` fica de fora de propósito: corrigir um typo não é razão
    // para a mensagem perder o lugar dela na ordenação por mais usadas.
    await ref.update({ texto: dados.texto, categoria: dados.categoria });
    const depois = await ref.get();
    return normalizarMensagemDaLive({ id, ...depois.data() });
  },

  async remover(id: string) {
    await colecao().doc(id).delete();
  },

  async registrarCopia(id: string) {
    // `increment` em vez de ler-somar-gravar: duas pessoas copiando a mesma
    // mensagem ao mesmo tempo (o que numa live acontece) perderiam uma das
    // contagens no caminho ler→gravar.
    try {
      await colecao().doc(id).update({ vezesCopiada: FieldValue.increment(1) });
    } catch {
      // Contador é conveniência, não dado. Se a mensagem sumiu entre o clique
      // e a gravação, o texto já foi para a área de transferência — não há
      // por que devolver erro a quem está ao vivo.
    }
  },
};

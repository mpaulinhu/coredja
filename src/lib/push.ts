import webpush from 'web-push';
import { getFirestoreDb } from './firebase';

/**
 * Notificação no celular mesmo com o site fechado (Web Push).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COMO FUNCIONA
 * ────────────────────────────────────────────────────────────────────────────
 * O navegador de cada pessoa cria uma "inscrição" — um endereço único no
 * servidor do próprio navegador (Google para Chrome, Apple para Safari). O
 * Coredja guarda esse endereço e, quando chega recado, manda o aviso para
 * ele. Quem entrega no aparelho é o Google/Apple, não nós: por isso funciona
 * com o site fechado, e por isso não há custo.
 *
 * As chaves VAPID provam que o envio veio deste servidor. A pública vai ao
 * navegador; a privada assina e nunca sai daqui.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE ESPERAR NO iPHONE
 * ────────────────────────────────────────────────────────────────────────────
 * O Safari só entrega push se a pessoa tiver adicionado o site à Tela de
 * Início ("Compartilhar → Adicionar à Tela de Início"). É exigência da
 * Apple, não uma limitação daqui — no Android o Chrome funciona direto.
 */

const COLECAO = 'push_inscricoes';

/** Um aparelho inscrito para receber notificação. */
export interface Inscricao {
  /** O endpoint é único por aparelho — serve de id do documento. */
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** De quem é este aparelho, para saber a quem notificar. */
  uid: string;
  /** Departamento da pessoa no momento da inscrição — filtra os envios. */
  departamento?: string;
  criadaEm: string;
}

/** Se as chaves estão configuradas neste servidor. Sem elas, push fica inerte. */
export function pushConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

let configurado = false;
function configurar(): void {
  if (configurado) return;
  webpush.setVapidDetails(
    // `mailto:` é o contato que o serviço de push usa se algo der errado com
    // os nossos envios. Não precisa ser real para funcionar, mas é o campo
    // que identifica quem está mandando.
    'mailto:coredja@igreja.local',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configurado = true;
}

/** Guarda (ou atualiza) a inscrição de um aparelho. */
export async function salvarInscricao(
  inscricao: Omit<Inscricao, 'criadaEm'>,
): Promise<void> {
  await getFirestoreDb()
    .collection(COLECAO)
    .doc(idDoEndpoint(inscricao.endpoint))
    .set({ ...inscricao, criadaEm: new Date().toISOString() });
}

/** Remove a inscrição de um aparelho — quem desliga a notificação. */
export async function removerInscricao(endpoint: string): Promise<void> {
  await getFirestoreDb().collection(COLECAO).doc(idDoEndpoint(endpoint)).delete();
}

/**
 * O endpoint é uma URL longa, com barras e caracteres que o Firestore não
 * aceita em id de documento. Um hash simples resolve — só precisa ser
 * estável e único, não secreto.
 */
function idDoEndpoint(endpoint: string): string {
  let h = 0;
  for (let i = 0; i < endpoint.length; i++) {
    h = (h << 5) - h + endpoint.charCodeAt(i);
    h |= 0;
  }
  return `e${Math.abs(h)}_${endpoint.slice(-24).replace(/[^a-zA-Z0-9]/g, '')}`;
}

interface Aviso {
  titulo: string;
  corpo: string;
  url?: string;
  urgente?: boolean;
  /** Recados da mesma conversa se substituem no aparelho — ver `tag` no sw.js. */
  conversaId?: string;
}

/**
 * Manda o aviso para os aparelhos das pessoas indicadas.
 *
 * Nunca lança: notificar é o acessório — o recado já está gravado, e uma
 * falha aqui não pode derrubar o envio da mensagem.
 *
 * Inscrição que o navegador já descartou responde 404/410. Nesse caso o
 * registro é apagado: sem isso a lista só cresceria, com endereços mortos
 * consumindo uma tentativa de envio cada, para sempre.
 */
export async function notificar(uids: string[], aviso: Aviso): Promise<number> {
  if (!pushConfigurado() || uids.length === 0) return 0;
  configurar();

  const db = getFirestoreDb();
  // `in` do Firestore aceita no máximo 30 valores por consulta — a igreja
  // tem poucas pessoas, mas fatiar evita uma falha silenciosa se crescer.
  const lotes: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) lotes.push(uids.slice(i, i + 30));

  const inscricoes: (Inscricao & { id: string })[] = [];
  for (const lote of lotes) {
    const snap = await db.collection(COLECAO).where('uid', 'in', lote).get();
    snap.docs.forEach((d) => inscricoes.push({ id: d.id, ...(d.data() as Inscricao) }));
  }

  const corpo = JSON.stringify(aviso);
  let entregues = 0;

  await Promise.all(
    inscricoes.map(async (inscricao) => {
      try {
        await webpush.sendNotification(
          { endpoint: inscricao.endpoint, keys: inscricao.keys },
          corpo,
        );
        entregues += 1;
      } catch (erro) {
        const status = (erro as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.collection(COLECAO).doc(inscricao.id).delete().catch(() => {});
        }
        // Outros erros (rede, serviço fora do ar) não apagam nada: a
        // inscrição pode voltar a funcionar no próximo recado.
      }
    }),
  );

  return entregues;
}

/**
 * Avisa quem participa da conversa que chegou recado novo.
 *
 * Notifica as pessoas dos DOIS departamentos da conversa, menos quem
 * escreveu — receber alerta da própria mensagem é ruído puro. Uma pessoa
 * com vários aparelhos inscritos recebe em todos, como em qualquer
 * aplicativo de mensagem.
 *
 * Nunca lança: quem chama está gravando um recado, e o recado vale mesmo
 * que a notificação falhe.
 */
export async function notificarRecadoNovo(dados: {
  conversaId: string;
  /** Slug de quem escreveu — as pessoas desse departamento não são avisadas. */
  remetente: string;
  /** Nome do departamento que escreveu, para o título do aviso. */
  nomeDoRemetente: string;
  texto: string;
  urgente: boolean;
  /** UID de quem escreveu, para não notificar a própria pessoa. */
  autorUid?: string;
}): Promise<void> {
  try {
    if (!pushConfigurado()) return;

    const [deptoA, deptoB] = dados.conversaId.split('__');
    if (!deptoA || !deptoB) return;

    const { pessoasStore } = await import('./pessoas-store');
    const pessoas = await pessoasStore.listar();

    const alvos = pessoas
      .filter((p) => p.departamento === deptoA || p.departamento === deptoB)
      // Quem escreveu não é avisado — nem pelo departamento, nem pelo uid
      // (uma pessoa pode estar no mesmo departamento de quem escreveu e
      // ainda assim precisar do aviso; por isso as duas checagens).
      .filter((p) => p.departamento !== dados.remetente && p.uid !== dados.autorUid)
      .map((p) => p.uid);

    if (alvos.length === 0) return;

    await notificar(alvos, {
      titulo: dados.urgente
        ? `🔴 URGENTE · ${dados.nomeDoRemetente}`
        : dados.nomeDoRemetente,
      // Recado só com imagem chega sem texto — dizer isso é melhor que um
      // aviso vazio que não explica o que chegou.
      corpo: dados.texto.trim() || 'Enviou uma imagem.',
      url: '/painel',
      urgente: dados.urgente,
      conversaId: dados.conversaId,
    });
  } catch {
    // Notificar é acessório: o recado já está gravado.
  }
}

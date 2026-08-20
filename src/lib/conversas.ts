import { podeConversarCom, type Pessoa } from './papeis';
import { store } from './store';
import {
  AUDIOVISUAL_SLUG,
  conversaTemUrgencia,
  idDaConversa,
  type Conversa,
} from './conversa-compartilhado';

export { AUDIOVISUAL_SLUG, idDaConversa, conversaTemUrgencia, type Conversa } from './conversa-compartilhado';

/**
 * Montagem das conversas para o painel.
 *
 * O painel é uma lista de conversas, uma por par de departamentos, como num
 * aplicativo de mensagem: as respostas de um departamento ficam dentro da
 * conversa a que pertencem, nunca soltas numa fila junto com os recados que
 * chegam.
 *
 * Depende de `store`, que carrega `firebase-admin` (Node-only) — por isso
 * este arquivo nunca deve ser importado por um Client Component. As peças
 * sem essa dependência vivem em `conversa-compartilhado.ts`, que pode.
 */

/** Quantas mensagens de cada conversa são carregadas. */
const LIMITE_POR_CONVERSA = 80;

/**
 * Se esta conversa é da pessoa: ela precisa ser uma das duas pontas.
 *
 * Conversa entre dois outros departamentos (ex: Kids ↔ Audiovisual, para
 * alguém da Cantina) não aparece — não é dela, e ela não teria como
 * participar sem virar uma terceira voz. Quem controla com quem cada
 * departamento pode conversar é `podeConversarCom` (ver `papeis.ts`).
 */
function minhaConversa(pessoa: Pessoa, deptoA: string, deptoB: string): boolean {
  return pessoa.departamento === deptoA || pessoa.departamento === deptoB;
}

/**
 * Monta a lista de conversas relevantes para `pessoa`, ordenada por
 * relevância para quem opera: quem tem urgente primeiro, depois quem tem
 * pendente, depois por atividade mais recente. Assim o que precisa de ação
 * nunca fica embaixo.
 *
 * Diferente do modelo antigo (uma conversa fixa por área, sempre com o
 * Audiovisual), agora as conversas existentes são derivadas de
 * `listarConversasComMensagem()` — só existe conversa entre dois
 * departamentos depois que alguém manda a primeira mensagem (ver Etapa 5,
 * "Nova conversa", fora do escopo desta função).
 *
 * A pessoa vê as conversas em que ela é uma das pontas — ou seja, as do
 * departamento dela. Além dessas, entram as conversas ainda VAZIAS com cada
 * departamento que ela pode conversar (`podeConversarCom`), para que dê para
 * puxar assunto com quem nunca trocou mensagem ainda.
 */
export async function montarConversas(pessoa: Pessoa): Promise<Conversa[]> {
  const [conversasComMensagem, departamentos] = await Promise.all([
    store.listarConversasComMensagem(),
    store.listarDepartamentos(),
  ]);

  const porSlug = new Map(departamentos.map((d) => [d.slug, d]));

  const comMensagem = conversasComMensagem.filter((c) =>
    minhaConversa(pessoa, c.deptoA, c.deptoB),
  );

  // Conversas ainda sem nenhuma mensagem com quem esta pessoa pode falar —
  // sem isso não haveria por onde começar uma conversa nova.
  const meu = pessoa.departamento;
  const jaListadas = new Set(comMensagem.map((c) => c.conversaId));
  const vazias = meu
    ? podeConversarCom(
        pessoa,
        departamentos.map((d) => d.slug),
      )
        .map((outro) => ({
          conversaId: idDaConversa(meu, outro),
          deptoA: meu,
          deptoB: outro,
        }))
        .filter((c) => !jaListadas.has(c.conversaId))
    : [];

  const relevantes = [...comMensagem, ...vazias];

  const conversas = await Promise.all(
    relevantes.map(async (c): Promise<Conversa | null> => {
      const deptoA = porSlug.get(c.deptoA);
      const deptoB = porSlug.get(c.deptoB);
      // Um departamento pode ter sido removido pelo CRUD (Etapa 4) sem que
      // isso apague o histórico — ver decisão em plano, "apagar departamento
      // não bloqueia". Sem o registro de nome/cor não dá para exibir a
      // conversa no painel, então ela é pulada aqui (o histórico continua
      // acessível por outros meios, ex: consulta direta por conversaId).
      if (!deptoA || !deptoB) return null;

      const temUrgencia = conversaTemUrgencia(c.deptoA, c.deptoB);
      const mensagens = await store.listarPorConversa(c.conversaId, LIMITE_POR_CONVERSA);

      const pendentes = temUrgencia
        ? mensagens.filter((m) => m.remetente !== AUDIOVISUAL_SLUG && !m.resolvidaEm)
        : [];

      return {
        deptoA,
        deptoB,
        temUrgencia,
        mensagens,
        pendentes: pendentes.length,
        temUrgente: pendentes.some((m) => m.prioridade === 'urgente'),
        ultima: mensagens.at(-1) ?? null,
      };
    }),
  );

  return conversas
    .filter((c): c is Conversa => c !== null)
    .sort((a, b) => {
      if (a.temUrgente !== b.temUrgente) return a.temUrgente ? -1 : 1;
      if ((a.pendentes > 0) !== (b.pendentes > 0)) return a.pendentes > 0 ? -1 : 1;

      const quandoA = a.ultima?.criadaEm ?? '';
      const quandoB = b.ultima?.criadaEm ?? '';
      return quandoB.localeCompare(quandoA);
    });
}

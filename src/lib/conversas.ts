import { store } from './store';
import type { Area, Mensagem } from './types';

/**
 * Montagem das conversas para o painel do audiovisual.
 *
 * O painel é uma lista de conversas, uma por área, como num aplicativo de
 * mensagem: as respostas do audiovisual ficam dentro da conversa da área a
 * que pertencem, nunca soltas numa fila junto com os recados que chegam.
 */

/** Uma conversa com uma área, do jeito que o painel precisa exibir. */
export interface Conversa {
  area: Area;
  /** Toda a troca com essa área, da mais antiga para a mais recente. */
  mensagens: Mensagem[];
  /** Recados da área ainda não resolvidos. É o que o crachá mostra. */
  pendentes: number;
  /** Se algum dos pendentes é urgente — define o destaque em vermelho. */
  temUrgente: boolean;
  /** Última mensagem da conversa, para a prévia na lista. */
  ultima: Mensagem | null;
}

/** Quantas mensagens de cada conversa são carregadas. */
const LIMITE_POR_CONVERSA = 80;

/**
 * Monta a lista de conversas, ordenada por relevância para quem opera:
 * quem tem urgente primeiro, depois quem tem pendente, depois por atividade
 * mais recente. Assim o que precisa de ação nunca fica embaixo.
 *
 * `areasVisiveis`, se passado, restringe a lista aos slugs indicados — é
 * como a permissão por área de `pessoa.areasVisiveis` (ver `papeis.ts`) se
 * aplica aqui. Sem o parâmetro, monta todas: uso interno de quem já filtrou
 * antes de chamar, nunca direto numa rota que atende pessoa logada.
 */
export async function montarConversas(areasVisiveis?: string[]): Promise<Conversa[]> {
  const todasAsAreas = await store.listarAreas();
  const areas = areasVisiveis
    ? todasAsAreas.filter((a) => areasVisiveis.includes(a.slug))
    : todasAsAreas;

  const conversas = await Promise.all(
    areas.map(async (area): Promise<Conversa> => {
      const mensagens = await store.listarPorArea(area.slug, LIMITE_POR_CONVERSA);

      // Só conta o que a área mandou: uma resposta do audiovisual não é algo
      // que ele mesmo precise resolver.
      const pendentes = mensagens.filter(
        (m) => m.autor === 'area' && !m.resolvidaEm,
      );

      return {
        area,
        mensagens,
        pendentes: pendentes.length,
        temUrgente: pendentes.some((m) => m.prioridade === 'urgente'),
        ultima: mensagens.at(-1) ?? null,
      };
    }),
  );

  return conversas.sort((a, b) => {
    if (a.temUrgente !== b.temUrgente) return a.temUrgente ? -1 : 1;
    if ((a.pendentes > 0) !== (b.pendentes > 0)) return a.pendentes > 0 ? -1 : 1;

    const quandoA = a.ultima?.criadaEm ?? '';
    const quandoB = b.ultima?.criadaEm ?? '';
    return quandoB.localeCompare(quandoA);
  });
}

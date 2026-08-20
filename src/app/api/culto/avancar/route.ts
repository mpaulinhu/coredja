import { ajustarCronometroDoBloco } from '@/lib/culto-cronometro';
import { cultoStore } from '@/lib/culto-store';
import { holyricsParaTela } from '@/lib/holyrics';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Avança para o próximo bloco do culto que está no ar. Rota própria, separada
 * de `PUT /api/culto`, porque a permissão é outra: um operador pode avançar no
 * domingo sem poder reescrever a sequência que o líder montou na semana.
 *
 * `culto:avancar` já é herdada por Líder (e Admin acima), então checar só
 * ela cobre todo mundo que antes precisava do OR com `culto:escrever`.
 *
 * Sem corpo, opera sobre a ativa (a de hoje, senão a próxima futura) — é o
 * caso do operador no domingo, que não escolhe qual culto está acontecendo.
 * Com `cultoId` no corpo, opera sobre aquela ordem: a tela de operação deixa
 * um líder abrir um culto específico (um ensaio, o da noite antes da hora), e
 * aí avançar precisa mexer no que ele está vendo, não no que o relógio elegeu.
 *
 * Avançar também joga o tempo do bloco novo no cronômetro do Holyrics, para
 * quem está no palco ver quanto falta (ver `culto-cronometro.ts`, comum a
 * esta rota e à de pular direto para um bloco). Mesma regra de
 * `avisos/[id]/telao`: o avanço é gravado primeiro e nunca é desfeito por
 * causa do Holyrics — se ele estiver fechado, o culto anda igual e a resposta
 * carrega `holyrics` para a tela contar o que não deu certo.
 */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'culto:avancar')) {
    return Response.json(
      { erro: 'Seu papel não pode avançar o culto.' },
      { status: 403 },
    );
  }

  // Corpo é opcional: o operador manda POST vazio e ganha a ordem ativa.
  const corpo = (await request.json().catch(() => null)) as { cultoId?: unknown } | null;
  const pedido = typeof corpo?.cultoId === 'string' ? corpo.cultoId : null;

  const alvo = pedido ? await cultoStore.buscar(pedido) : await cultoStore.buscarAtiva();
  if (!alvo) {
    return Response.json({ erro: 'Nenhum culto montado ainda.' }, { status: 404 });
  }

  const culto = await cultoStore.avancar(alvo.id);
  const holyrics = culto
    ? await ajustarCronometroDoBloco(culto.blocoAtualId, culto.blocos)
    : null;

  return Response.json({
    culto,
    holyrics: holyrics ? holyricsParaTela(holyrics) : null,
  });
}

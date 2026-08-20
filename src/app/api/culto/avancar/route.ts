import { cultoStore } from '@/lib/culto-store';
import {
  holyricsParaTela,
  iniciarCronometroNoHolyrics,
  pararCronometroNoHolyrics,
  type ResultadoHolyrics,
} from '@/lib/holyrics';
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
 * Não recebe qual ordem avançar: opera sempre sobre a ativa (a de hoje, senão
 * a próxima futura). É o caso de uso real — no domingo se avança o culto do
 * dia — e evita que um cliente desatualizado empurre o culto errado.
 *
 * Avançar também joga o tempo do bloco novo no cronômetro do Holyrics, para
 * quem está no palco ver quanto falta. Mesma regra de `avisos/[id]/telao`: o
 * avanço é gravado primeiro e nunca é desfeito por causa do Holyrics — se ele
 * estiver fechado, o culto anda igual e a resposta carrega `holyrics` para a
 * tela contar o que não deu certo.
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

  const ativa = await cultoStore.buscarAtiva();
  if (!ativa) {
    return Response.json({ erro: 'Nenhum culto montado ainda.' }, { status: 404 });
  }

  const culto = await cultoStore.avancar(ativa.id);
  const holyrics = culto ? await ajustarCronometro(culto.blocoAtualId, culto.blocos) : null;

  return Response.json({
    culto,
    holyrics: holyrics ? holyricsParaTela(holyrics) : null,
  });
}

/**
 * Põe o cronômetro no tempo do bloco que passou a ser o atual.
 *
 * Dois casos que não são erro e por isso não viram cronômetro novo:
 * - **Acabou o culto** (`blocoAtualId` volta a `null` depois do último bloco,
 *   ver `culto-store.avancar`): o certo é PARAR, senão o cronômetro do último
 *   bloco fica correndo negativo para sempre na tela de retorno.
 * - **Bloco sem minutos** (`0` ou ausente): cronometrar zero não significa
 *   nada. Deixa como está, sem tratar como falha.
 */
async function ajustarCronometro(
  blocoAtualId: string | null,
  blocos: { id: string; minutos: number }[],
): Promise<ResultadoHolyrics | null> {
  if (blocoAtualId === null) return pararCronometroNoHolyrics();

  const bloco = blocos.find((b) => b.id === blocoAtualId);
  const minutos = bloco?.minutos ?? 0;
  if (minutos <= 0) return null;

  return iniciarCronometroNoHolyrics(minutos);
}

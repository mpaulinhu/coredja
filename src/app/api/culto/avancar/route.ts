import { cultoStore } from '@/lib/culto-store';
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
  return Response.json({ culto });
}

import { cultoStore } from '@/lib/culto-store';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Avança para o próximo bloco do culto. Rota própria, separada de
 * `PUT /api/culto`, porque a permissão é outra: um operador pode avançar no
 * domingo sem poder reescrever a sequência que o líder montou na semana.
 */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papeis, 'culto:avancar') && !podeFazer(pessoa.papeis, 'culto:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode avançar o culto.' },
      { status: 403 },
    );
  }

  const culto = await cultoStore.avancar();
  if (!culto) {
    return Response.json({ erro: 'Nenhum culto montado ainda.' }, { status: 404 });
  }
  return Response.json({ culto });
}

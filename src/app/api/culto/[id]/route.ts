import { cultoStore } from '@/lib/culto-store';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Apaga uma ordem de culto. Mesma permissão de montar (`culto:escrever`):
 * quem escreve a sequência é quem pode desistir dela — um operador de domingo
 * não deve conseguir sumir com o que o líder preparou.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'culto:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode apagar a ordem do culto.' },
      { status: 403 },
    );
  }

  const { id } = await params;
  const existente = await cultoStore.buscar(id);
  if (!existente) {
    return Response.json({ erro: 'Essa ordem não existe mais.' }, { status: 404 });
  }

  await cultoStore.remover(id);
  return Response.json({ ok: true });
}

/**
 * Marca ou desmarca uma ordem como concluída. Mesma permissão de montar
 * (`culto:escrever`): concluir manualmente é uma decisão de quem preparou a
 * ordem, não de quem só opera o avançar no domingo.
 *
 * Independente de `blocoAtualId` — dá para concluir sem ter passado por todos
 * os blocos (culto que encurtou), e chegar ao último bloco não conclui
 * sozinho. Ver a nota em `culto.ts`.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'culto:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode concluir ou reabrir a ordem do culto.' },
      { status: 403 },
    );
  }

  const { id } = await params;

  let corpo: { acao?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const acao = corpo.acao;
  if (acao !== 'concluir' && acao !== 'reabrir') {
    return Response.json({ erro: 'Ação inválida.' }, { status: 400 });
  }

  const culto = await cultoStore.concluir(id, acao === 'concluir');
  if (!culto) {
    return Response.json({ erro: 'Essa ordem não existe mais.' }, { status: 404 });
  }

  return Response.json({ culto });
}

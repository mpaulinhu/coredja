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

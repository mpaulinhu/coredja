import { lerCorpoDaMensagem } from '@/lib/live';
import { mensagensDaLiveStore } from '@/lib/live-store';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/** Edita o texto ou a categoria. Só quem tem `live:escrever` (coordenador). */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'live:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode editar mensagens da live.' },
      { status: 403 },
    );
  }

  const dados = await lerCorpoDaMensagem(request);
  if ('erro' in dados) {
    return Response.json({ erro: dados.erro }, { status: 400 });
  }

  const { id } = await params;
  const mensagem = await mensagensDaLiveStore.atualizar(id, dados);
  if (!mensagem) {
    return Response.json({ erro: 'Mensagem não encontrada.' }, { status: 404 });
  }

  return Response.json({ mensagem });
}

/** Apaga uma mensagem fixa. Só quem tem `live:escrever` (coordenador). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'live:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode apagar mensagens da live.' },
      { status: 403 },
    );
  }

  const { id } = await params;
  await mensagensDaLiveStore.remover(id);
  return Response.json({ ok: true });
}

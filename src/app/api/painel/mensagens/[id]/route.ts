import { conversaTemUrgencia } from '@/lib/conversas';
import { publicar } from '@/lib/eventos';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { store } from '@/lib/store';

/**
 * Resolver e reabrir um recado.
 *
 * Resolver tira o recado da lista ativa e o manda para o histórico; reabrir
 * desfaz, para o caso de um clique errado no meio do culto. Só faz sentido
 * em conversas que envolvem o Audiovisual — as demais não têm esse aparato.
 */

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await params;

  let corpo: { acao?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const acao = corpo.acao;
  if (acao !== 'resolver' && acao !== 'reabrir') {
    return Response.json({ erro: 'Ação inválida.' }, { status: 400 });
  }

  const atual = await store.buscarMensagem(id);
  if (!atual) {
    return Response.json({ erro: 'Recado não encontrado.' }, { status: 404 });
  }

  const [deptoA, deptoB] = atual.conversaId.split('__');

  // Só mexe no estado de uma conversa quem é uma das pontas dela.
  const podeAgir =
    pessoa.departamento === deptoA || pessoa.departamento === deptoB;

  if (!podeAgir) {
    return Response.json(
      { erro: 'Esta conversa não é do seu departamento.' },
      { status: 403 },
    );
  }

  if (!conversaTemUrgencia(deptoA, deptoB)) {
    return Response.json(
      { erro: 'Esta conversa não usa resolver/reabrir.' },
      { status: 400 },
    );
  }

  const mensagem =
    acao === 'resolver'
      ? await store.resolverMensagem(id)
      : await store.reabrirMensagem(id);

  if (!mensagem) {
    return Response.json({ erro: 'Recado não encontrado.' }, { status: 404 });
  }

  publicar(
    acao === 'resolver' ? 'mensagem-resolvida' : 'mensagem-reaberta',
    mensagem.conversaId,
  );

  return Response.json({ mensagem });
}

/**
 * Apaga um recado de vez.
 *
 * Diferente de `resolver`, que só o tira da conversa e o guarda no
 * histórico: aqui não há como desfazer, e por isso a trava é a de
 * administração (`departamentos:escrever`) e não a de operar o painel —
 * quem está na cabine no domingo resolve recado o tempo todo, e um apagar
 * ao lado do resolver, com a mesma permissão, seria fácil de errar no meio
 * do culto.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'departamentos:escrever')) {
    return Response.json(
      { erro: 'Só quem administra o Coredja apaga recado.' },
      { status: 403 },
    );
  }

  const { id } = await params;
  const atual = await store.buscarMensagem(id);
  if (!atual) {
    return Response.json({ erro: 'Recado não encontrado.' }, { status: 404 });
  }

  await store.apagarMensagem(id);
  publicar('mensagem-apagada', atual.conversaId);

  return Response.json({ ok: true });
}

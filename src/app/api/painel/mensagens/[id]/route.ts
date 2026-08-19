import { publicar } from '@/lib/eventos';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { store } from '@/lib/store';

/**
 * Resolver e reabrir um recado.
 *
 * Resolver tira o recado da lista ativa e o manda para o histórico; reabrir
 * desfaz, para o caso de um clique errado no meio do culto.
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

  const mensagem =
    acao === 'resolver'
      ? await store.resolverMensagem(id)
      : await store.reabrirMensagem(id);

  if (!mensagem) {
    return Response.json({ erro: 'Recado não encontrado.' }, { status: 404 });
  }

  // O id não revela a área antes de buscar — por isso a checagem vem depois
  // da operação, não antes. Sem acesso à área, desfaz e nega: o banco nunca
  // fica com um estado que a checagem reprovaria.
  if (!pessoa.areasVisiveis?.includes(mensagem.areaSlug)) {
    if (acao === 'resolver') await store.reabrirMensagem(id);
    else await store.resolverMensagem(id);
    return Response.json(
      { erro: 'Você não tem acesso a esta área.' },
      { status: 403 },
    );
  }

  publicar(
    acao === 'resolver' ? 'mensagem-resolvida' : 'mensagem-reaberta',
    mensagem.areaSlug,
  );

  return Response.json({ mensagem });
}

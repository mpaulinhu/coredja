import { publicar } from '@/lib/eventos';
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

  publicar(
    acao === 'resolver' ? 'mensagem-resolvida' : 'mensagem-reaberta',
    mensagem.areaSlug,
  );

  return Response.json({ mensagem });
}

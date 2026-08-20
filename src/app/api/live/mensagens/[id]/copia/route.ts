import { mensagensDaLiveStore } from '@/lib/live-store';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Soma uma cópia ao contador da mensagem.
 *
 * Sem checagem de `live:escrever` de propósito: quem opera a live copia sem
 * poder cadastrar, e é justamente o uso dele que deveria empurrar a mensagem
 * para o topo da categoria. Exigir permissão de escrita aqui faria o contador
 * registrar só o coordenador, que é quem menos usa a tela ao vivo.
 *
 * O corpo é vazio — o id na URL basta. E o retorno é sempre `ok`: o texto já
 * foi para a área de transferência antes desta chamada sair, então uma falha
 * aqui não tem o que desfazer nem o que contar a quem está ao vivo.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await params;
  await mensagensDaLiveStore.registrarCopia(id);
  return Response.json({ ok: true });
}

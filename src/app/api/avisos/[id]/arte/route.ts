import { avisosStore } from '@/lib/avisos-store';
import { holyricsParaTela as paraTela, projetarArteDoAviso, deuCerto } from '@/lib/holyrics';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { registrarArteNoAr } from '@/lib/telao-fila-store';

export const dynamic = 'force-dynamic';

/**
 * Projeta SÓ a arte de um aviso no telão — sem tocar no painel de
 * comunicação (a tela de retorno, com o texto).
 *
 * Rota própria, separada de `/api/avisos/[id]/telao`, desde 25/08/2026: a
 * tela de Avisos passou a tratar "arte no telão" e "texto no retorno" como
 * duas ações de peso igual, cada uma com seu próprio botão — e a rota de
 * `telao` sempre publica o aviso (`avisosStore.publicar`, que marca `noAr`)
 * além de mandar o texto, o que não faz sentido para quem só quer a arte.
 *
 * Mesma permissão de publicar no telão (`avisos:publicar`).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'avisos:publicar')) {
    return Response.json({ erro: 'Seu papel não pode publicar no telão.' }, { status: 403 });
  }

  const { id } = await params;
  const aviso = await avisosStore.buscar(id);
  if (!aviso) {
    return Response.json({ erro: 'Aviso não encontrado.' }, { status: 404 });
  }
  if (!aviso.imagem) {
    return Response.json({ erro: 'Este aviso não tem arte para projetar.' }, { status: 400 });
  }

  const holyrics = await projetarArteDoAviso(aviso.imagem);
  if (deuCerto(holyrics.estado)) {
    await registrarArteNoAr(id);
  }

  return Response.json({ holyrics: paraTela(holyrics) });
}

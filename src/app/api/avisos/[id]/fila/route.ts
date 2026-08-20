import { avisosStore } from '@/lib/avisos-store';
import {
  enviarAvisoAFilaDoHolyrics,
  holyricsParaTela as paraTela,
} from '@/lib/holyrics';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Manda o aviso para a fila do Holyrics, sem projetar.
 *
 * Separada de `telao/route.ts` porque são intenções diferentes: lá o aviso
 * vai para a tela na hora; aqui ele só entra na playlist e quem opera decide
 * quando exibir. Não mexe no estado de publicado do Coredja — o aviso não
 * está "no ar", está entregue a quem opera.
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
    return Response.json(
      { erro: 'Seu papel não pode mandar avisos ao Holyrics.' },
      { status: 403 },
    );
  }

  const { id } = await params;
  const aviso = await avisosStore.buscar(id);
  if (!aviso) {
    return Response.json({ erro: 'Aviso não encontrado.' }, { status: 404 });
  }

  const holyrics = await enviarAvisoAFilaDoHolyrics(aviso);
  return Response.json({ holyrics: paraTela(holyrics) });
}


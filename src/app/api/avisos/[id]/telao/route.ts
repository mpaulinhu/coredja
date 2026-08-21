import { avisosStore } from '@/lib/avisos-store';
import {
  enviarAvisoAoHolyrics,
  holyricsParaTela as paraTela,
  limparAvisoNoHolyrics,
} from '@/lib/holyrics';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Põe/tira um aviso do telão. Rota própria, separada de `POST /api/avisos`,
 * pela mesma razão de `culto/avancar`: a permissão é outra — quem opera no
 * domingo publica sem precisar poder cadastrar ou apagar aviso.
 *
 * `avisos:publicar` já é herdada por Líder (e Admin acima), então checar só
 * ela cobre todo mundo que antes precisava do OR com `avisos:escrever`.
 *
 * Publicar aqui é o que vale: o estado no banco é gravado primeiro e nunca é
 * desfeito por causa do Holyrics. Se o envio ao Holyrics falhar (fechado,
 * rede fora, token errado), o aviso continua publicado no Coredja e a
 * resposta carrega `holyrics` para a tela contar o que não deu certo — em
 * vez de falhar em silêncio ou desfazer o que o usuário pediu.
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

  // `?projetarImagem=1` manda o Holyrics jogar a arte no telão na mesma hora.
  // Sem ele (o padrão), a imagem apenas fica pronta na pasta de Fotos, para
  // quem está na cabine exibir na hora certa — ver `dadosDoComando.aviso`.
  const projetarImagem =
    new URL(request.url).searchParams.get('projetarImagem') === '1';

  const avisos = await avisosStore.publicar(id);
  const holyrics = await enviarAvisoAoHolyrics(aviso, projetarImagem);

  return Response.json({ avisos, holyrics: paraTela(holyrics) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'avisos:publicar')) {
    return Response.json({ erro: 'Seu papel não pode alterar o telão.' }, { status: 403 });
  }

  const { id } = await params;
  const avisos = await avisosStore.ocultar(id);
  const holyrics = await limparAvisoNoHolyrics();

  return Response.json({ avisos, holyrics: paraTela(holyrics) });
}


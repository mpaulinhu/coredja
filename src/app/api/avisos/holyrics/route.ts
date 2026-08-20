import { holyricsConfigurado, MOTIVO_IMAGEM_NAO_SUPORTADA } from '@/lib/holyrics';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Se a integração com o Holyrics está ligada neste servidor.
 *
 * A tela precisa saber para explicar, num aviso-imagem, por que ele não vai
 * ser projetado automaticamente. Devolve só o booleano — nunca a URL nem o
 * token, que não podem chegar ao navegador.
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  return Response.json({
    configurado: holyricsConfigurado(),
    motivoImagem: MOTIVO_IMAGEM_NAO_SUPORTADA,
  });
}

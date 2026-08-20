import { holyricsConfigurado, MOTIVO_IMAGEM_NAO_SUPORTADA } from '@/lib/holyrics';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Se a integração com o Holyrics está ligada neste servidor.
 *
 * Vivia em `/api/avisos/holyrics`, mas deixou de ser assunto só dos avisos: a
 * Ordem do Culto precisa da mesma resposta para decidir se mostra os botões de
 * tempo extra. Subiu um nível para não haver duas rotas dizendo o mesmo.
 *
 * Devolve só o booleano — nunca a URL nem o token, que não podem chegar ao
 * navegador. `motivoImagem` vem junto porque é constante e a tela de avisos já
 * o usa; não vale uma segunda ida ao servidor só por ele.
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

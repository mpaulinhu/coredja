import { estadoDoTelao } from '@/lib/holyrics-presenca';
import { infoDaPonteAtiva } from '@/lib/telao-fila-store';
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
 *
 * `estado` responde uma pergunta diferente de `configurado`, e as duas
 * importam: `configurado` diz se ALGUÉM preencheu endereço e token; `estado`
 * diz se o telão responde AGORA. Dá para estar configurado e desconectado (o
 * PC do audiovisual desligado, o Holyrics fechado), e é justamente esse caso
 * que precisa aparecer na tela antes do domingo — até aqui só se descobria
 * clicando em "Projetar" e vendo o erro, ao vivo.
 *
 * A sonda tem cache curto e prazo de 1,5s (ver `holyrics-presenca.ts`), então
 * esta rota continua barata mesmo consultada por várias telas ao abrir.
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const [configurado, estado, ponte] = await Promise.all([
    holyricsConfigurado(),
    estadoDoTelao(),
    infoDaPonteAtiva(),
  ]);

  // O Conector é a ÚNICA forma de projetar arte: a API do Holyrics não recebe
  // imagem de fora, então o caminho direto sempre manda só o texto (ver
  // MOTIVO_IMAGEM_NAO_SUPORTADA). Sem esta informação a tela não tinha como
  // avisar ANTES — a pessoa clicava em "Projetar", o texto ia, a arte não, e
  // nada explicava a diferença.
  return Response.json({
    configurado,
    estado,
    motivoImagem: MOTIVO_IMAGEM_NAO_SUPORTADA,
    conectorAtivo: ponte !== null,
    conectorComputador: ponte?.computador ?? null,
  });
}

import { fecharArteNoHolyrics, holyricsParaTela as paraTela, deuCerto } from '@/lib/holyrics';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { registrarArteNoAr } from '@/lib/telao-fila-store';

export const dynamic = 'force-dynamic';

/**
 * Tira do telão a arte que está sendo exibida.
 *
 * Rota própria, e não um método a mais em `/api/avisos/[id]/telao`, porque
 * não é sobre um aviso: fecha o que estiver na projeção agora, seja qual for
 * a origem. Depois de exibida, a arte não pertence mais ao aviso que a levou
 * até lá — pedir um `id` obrigaria quem opera a lembrar de qual aviso veio a
 * imagem que está no telão.
 *
 * Mesma permissão de publicar (`avisos:publicar`): quem pode pôr no ar
 * precisa poder tirar.
 */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'avisos:publicar')) {
    return Response.json({ erro: 'Seu papel não pode alterar o telão.' }, { status: 403 });
  }

  const holyrics = await fecharArteNoHolyrics();
  if (!holyrics || deuCerto(holyrics.estado)) {
    await registrarArteNoAr(null);
  }
  return Response.json({ holyrics: paraTela(holyrics) });
}

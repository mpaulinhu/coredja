import { holyricsParaTela, somarTempoAoCronometroNoHolyrics } from '@/lib/holyrics';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/** Teto do que se pode dar de uma vez. Acima disso é engano de digitação. */
const MAXIMO_MINUTOS = 60;

/**
 * Dá mais alguns minutos ao bloco em andamento, sem mexer na ordem do culto.
 *
 * Mesma permissão de avançar (`culto:avancar`) porque é a mesma pessoa e o
 * mesmo momento: quem opera no domingo e vê o bloco estourando o tempo é
 * quem precisa esticar o cronômetro.
 *
 * Não toca no Firestore de propósito: os minutos do bloco são o PLANEJADO,
 * montado durante a semana, e não devem ser reescritos por um ajuste de
 * palco. O que muda aqui é só o relógio da tela de retorno.
 */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'culto:avancar')) {
    return Response.json(
      { erro: 'Seu papel não pode mexer no tempo do culto.' },
      { status: 403 },
    );
  }

  const corpo = (await request.json().catch(() => null)) as { minutos?: unknown } | null;
  const minutos = Number(corpo?.minutos);

  if (!Number.isFinite(minutos) || minutos <= 0 || minutos > MAXIMO_MINUTOS) {
    return Response.json(
      { erro: `Informe de 1 a ${MAXIMO_MINUTOS} minutos.` },
      { status: 400 },
    );
  }

  const holyrics = await somarTempoAoCronometroNoHolyrics(minutos);
  return Response.json({ holyrics: holyricsParaTela(holyrics) });
}

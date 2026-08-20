import { restanteDoBloco } from '@/lib/culto';
import { cultoStore } from '@/lib/culto-store';
import {
  holyricsParaTela,
  iniciarCronometroNoHolyrics,
  pararCronometroNoHolyrics,
  type ResultadoHolyrics,
} from '@/lib/holyrics';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Pausa ou retoma o cronômetro do bloco em andamento.
 *
 * Mesma permissão de avançar (`culto:avancar`): é a mesma pessoa, no mesmo
 * momento, mexendo na mesma coisa — quem pode empurrar o culto adiante pode
 * segurá-lo por um minuto.
 *
 * A pausa mora no documento (`pausadoEm`), não no estado da aba, porque
 * precisa valer entre aparelhos: quem pausou pelo celular no palco e quem
 * olha da mesa de som têm que ver o MESMO relógio parado. Ver `culto.ts`.
 *
 * O Holyrics acompanha, e é por isso que esta rota não é só um PATCH: pausar
 * sem parar o cronômetro do telão deixaria a congregação vendo um tempo
 * correndo que ninguém mais está contando. Retomar reinicia o cronômetro de
 * lá com o RESTANTE (não com a duração cheia do bloco) — a API do Holyrics
 * não sabe pausar, só ligar e desligar, então "retomar" é ligar de novo já
 * no ponto certo.
 */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'culto:avancar')) {
    return Response.json(
      { erro: 'Seu papel não pode pausar o culto.' },
      { status: 403 },
    );
  }

  const corpo = (await request.json().catch(() => null)) as {
    cultoId?: unknown;
    pausar?: unknown;
  } | null;

  if (typeof corpo?.pausar !== 'boolean') {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }
  const querPausar = corpo.pausar;

  // Mesmo contrato de `avancar`: sem `cultoId`, a ordem ativa.
  const pedido = typeof corpo.cultoId === 'string' ? corpo.cultoId : null;
  const alvo = pedido ? await cultoStore.buscar(pedido) : await cultoStore.buscarAtiva();
  if (!alvo) {
    return Response.json({ erro: 'Nenhum culto no ar agora.' }, { status: 404 });
  }

  const culto = await cultoStore.pausar(alvo.id, querPausar);
  if (!culto) {
    return Response.json({ erro: 'Essa ordem não existe mais.' }, { status: 404 });
  }

  const holyrics = await ajustarHolyrics(culto, querPausar);

  return Response.json({
    culto,
    holyrics: holyrics ? holyricsParaTela(holyrics) : null,
  });
}

/**
 * Para o cronômetro do Holyrics ao pausar; religa com o restante ao retomar.
 *
 * Devolve `null` quando não há nada a fazer no telão — retomar um bloco cujo
 * tempo já estourou (restante ≤ 0) não tem cronômetro positivo para ligar, e
 * mandar `0` faria o painel exibir um contador zerado no lugar do tempo
 * negativo que estava lá antes da pausa, que é a informação útil.
 */
async function ajustarHolyrics(
  culto: Parameters<typeof restanteDoBloco>[0],
  pausou: boolean,
): Promise<ResultadoHolyrics | null> {
  if (pausou) return pararCronometroNoHolyrics();

  const restante = restanteDoBloco(culto);
  if (restante <= 0) return null;

  return iniciarCronometroNoHolyrics(restante / 60);
}

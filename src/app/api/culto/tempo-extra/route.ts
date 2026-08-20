import { cultoStore } from '@/lib/culto-store';
import { holyricsParaTela, somarTempoAoCronometroNoHolyrics } from '@/lib/holyrics';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Teto do que se pode dar (ou tirar) de uma vez, para cada lado. Acima disso
 * é engano de digitação — os botões da tela mandam 1 e 5.
 */
const MAXIMO_MINUTOS = 60;

/**
 * Dá (ou tira) alguns minutos do bloco em andamento, sem mexer na ordem do
 * culto.
 *
 * Mesma permissão de avançar (`culto:avancar`) porque é a mesma pessoa e o
 * mesmo momento: quem opera no domingo e vê o bloco estourando o tempo é
 * quem precisa esticar o cronômetro.
 *
 * Não reescreve `bloco.minutos` de propósito: os minutos do bloco são o
 * PLANEJADO, montado durante a semana, e não devem ser alterados por um
 * ajuste de palco. O extra vai para um campo separado (`minutosExtras`), que
 * zera sozinho ao trocar de bloco — ver `culto.ts`.
 *
 * Antes esta rota só falava com o Holyrics. Passou a gravar também porque o
 * cronômetro agora existe na tela do Coredja: sem persistir, o "+5 min"
 * apareceria no telão e não no painel de quem opera, e sumiria num F5.
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

  const corpo = (await request.json().catch(() => null)) as {
    minutos?: unknown;
    cultoId?: unknown;
  } | null;
  const minutos = Number(corpo?.minutos);

  // Negativo é válido (é o "-1/-5" da tela), zero não: uma requisição que
  // não muda nada gravaria no Firestore e mexeria no telão à toa, então é
  // erro de quem chamou, não um no-op silencioso. Inteiro porque o
  // cronômetro do bloco é contado em minutos cheios aqui — quem precisa de
  // segundo usa `tempo-restante`.
  if (
    !Number.isInteger(minutos) ||
    minutos === 0 ||
    Math.abs(minutos) > MAXIMO_MINUTOS
  ) {
    return Response.json(
      {
        erro: `Informe de -${MAXIMO_MINUTOS} a ${MAXIMO_MINUTOS} minutos, exceto zero.`,
      },
      { status: 400 },
    );
  }

  // Mesmo contrato de `avancar`: sem `cultoId` opera sobre a ordem ativa (o
  // operador no domingo, que não escolhe qual culto está no ar); com id,
  // sobre a que a pessoa abriu na tela.
  const pedido = typeof corpo?.cultoId === 'string' ? corpo.cultoId : null;
  const alvo = pedido ? await cultoStore.buscar(pedido) : await cultoStore.buscarAtiva();
  const culto = alvo ? await cultoStore.darTempoExtra(alvo.id, minutos) : null;

  // O Holyrics vem DEPOIS de gravar, e um erro dele não desfaz o que já foi
  // gravado — mesma regra de `avancar`: o culto anda mesmo com o Holyrics
  // fechado, e a tela conta o que não deu certo.
  const holyrics = await somarTempoAoCronometroNoHolyrics(minutos);
  return Response.json({ culto, holyrics: holyricsParaTela(holyrics) });
}

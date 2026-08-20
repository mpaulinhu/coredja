import { cultoStore } from '@/lib/culto-store';
import { definirCronometroNoHolyrics, holyricsParaTela } from '@/lib/holyrics';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Teto do que dá para digitar no cronômetro. Um bloco de mais de 6 horas não
 * existe — acima disso é dedo errado, e o erro explícito é melhor que um
 * culto marcado para terminar amanhã.
 */
const MAXIMO_SEGUNDOS = 6 * 60 * 60;

/**
 * Define quanto AINDA FALTA do bloco em andamento — o número que a pessoa
 * digitou clicando no cronômetro da tela de operação.
 *
 * Rota separada de `tempo-extra` de propósito, apesar de as duas mexerem no
 * mesmo cronômetro. Elas alteram coisas diferentes:
 *
 * - `tempo-extra` mexe no PLANO do bloco (`minutosExtras`): "este bloco vai
 *   precisar de 5 minutos a mais do que estava previsto". A duração muda, o
 *   quanto já correu não.
 * - esta mexe no RELÓGIO (`segundosAcumulados`): "esqueceram de avançar, na
 *   verdade faltam 5 minutos". A duração fica como estava; o que muda é o
 *   quanto se considera já corrido.
 *
 * Um endpoint só, com um discriminador `modo`, seria duas rotas dentro de uma
 * — mesma URL, mesmos campos, semânticas incompatíveis. Separadas, cada uma
 * valida o que é seu (minutos inteiros com sinal lá; segundos absolutos aqui).
 *
 * Mesma permissão de avançar (`culto:avancar`), pela mesma razão das rotas
 * irmãs: é a mesma pessoa, no mesmo momento, mexendo na mesma coisa.
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
    segundos?: unknown;
    cultoId?: unknown;
  } | null;
  const segundos = Number(corpo?.segundos);

  // Zero é válido aqui (diferente de `tempo-extra`): "o tempo acabou agora"
  // é um ajuste legítimo. Negativo não — quem quer marcar que o bloco já
  // estourou tira tempo pelo `-1/-5`, e aceitar um restante negativo digitado
  // faria a tela mostrar "+05:00" para quem acabou de digitar "5".
  if (!Number.isInteger(segundos) || segundos < 0 || segundos > MAXIMO_SEGUNDOS) {
    return Response.json(
      { erro: `Informe de 0 a ${Math.floor(MAXIMO_SEGUNDOS / 60)} minutos.` },
      { status: 400 },
    );
  }

  // Mesmo contrato de `avancar`: sem `cultoId` opera sobre a ordem ativa (o
  // operador no domingo, que não escolhe qual culto está no ar); com id,
  // sobre a que a pessoa abriu na tela.
  const pedido = typeof corpo?.cultoId === 'string' ? corpo.cultoId : null;
  const alvo = pedido ? await cultoStore.buscar(pedido) : await cultoStore.buscarAtiva();
  if (!alvo) {
    return Response.json({ erro: 'Nenhum culto no ar agora.' }, { status: 404 });
  }

  const culto = await cultoStore.definirRestante(alvo.id, segundos);
  if (!culto) {
    // O store devolve null também quando não há bloco em andamento: sem
    // bloco não há relógio a acertar, e o recado precisa dizer isso em vez
    // de "essa ordem não existe".
    return Response.json(
      { erro: 'Nenhum bloco em andamento para acertar o tempo.' },
      { status: 409 },
    );
  }

  // O Holyrics vem DEPOIS de gravar, e um erro dele não desfaz o que já foi
  // gravado — mesma regra de `avancar`: o culto anda mesmo com o Holyrics
  // fechado, e a tela conta o que não deu certo.
  //
  // Com o culto pausado não se liga cronômetro nenhum no telão: pausar já
  // parou o de lá (ver `api/culto/pausar`), e religá-lo aqui faria o painel
  // voltar a correr enquanto a tela mostra "Pausado". O tempo novo chega ao
  // Holyrics quando alguém retomar, que é exatamente o que `pausar` faz.
  const holyrics = culto.pausadoEm ? null : await definirCronometroNoHolyrics(segundos);

  return Response.json({
    culto,
    holyrics: holyrics ? holyricsParaTela(holyrics) : null,
  });
}

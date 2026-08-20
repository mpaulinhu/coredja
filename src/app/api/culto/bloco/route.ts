import { ajustarCronometroDoBloco } from '@/lib/culto-cronometro';
import { cultoStore } from '@/lib/culto-store';
import { holyricsParaTela } from '@/lib/holyrics';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Põe o culto direto num bloco escolhido, sem passar pelos do meio.
 *
 * Existe porque `avancar` só anda para frente, um por vez: quem opera precisa
 * tanto pular adiante (o louvor emendou na palavra, os dois blocos do meio não
 * aconteceram) quanto VOLTAR quando avançou sem querer — antes disso a única
 * saída era salvar a ordem de novo no editor, o que reinicia tudo.
 *
 * Mesma permissão de avançar (`culto:avancar`): é a mesma pessoa, no mesmo
 * momento, mexendo na mesma coisa. Quem pode empurrar o culto um bloco por vez
 * não ganha poder novo podendo empurrar dois de uma vez.
 *
 * Ao contrário de `avancar`, `cultoId` é obrigatório: pular para um bloco só
 * faz sentido olhando uma sequência concreta na tela, e o id junto garante que
 * o bloco clicado e a ordem alterada são os mesmos que a pessoa está vendo.
 */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'culto:avancar')) {
    return Response.json(
      { erro: 'Seu papel não pode mudar o bloco do culto.' },
      { status: 403 },
    );
  }

  const corpo = (await request.json().catch(() => null)) as {
    cultoId?: unknown;
    blocoId?: unknown;
  } | null;

  const cultoId = typeof corpo?.cultoId === 'string' ? corpo.cultoId : '';
  const blocoId = typeof corpo?.blocoId === 'string' ? corpo.blocoId : '';
  if (!cultoId || !blocoId) {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  // O store recusa bloco que não é daquela ordem (ver `definirBlocoAtual`),
  // então uma resposta nula aqui cobre os dois casos de "não dá": ordem que
  // sumiu e bloco que não existe mais na sequência.
  const culto = await cultoStore.definirBlocoAtual(cultoId, blocoId);
  if (!culto) {
    return Response.json(
      { erro: 'Esse bloco não existe mais nesta ordem. Atualize a página.' },
      { status: 404 },
    );
  }

  const holyrics = await ajustarCronometroDoBloco(culto.blocoAtualId, culto.blocos);

  return Response.json({
    culto,
    holyrics: holyrics ? holyricsParaTela(holyrics) : null,
  });
}

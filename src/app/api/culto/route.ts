import { cultoStore } from '@/lib/culto-store';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import type { Bloco } from '@/lib/culto';

export const dynamic = 'force-dynamic';

/**
 * Todas as ordens de culto cadastradas, mais qual delas vale hoje.
 *
 * A ativa vem junto (só o id) em vez de numa rota à parte porque a tela de
 * montagem precisa das duas coisas ao mesmo tempo — a lista e o selo "no ar
 * hoje" — e uma requisição só evita que as duas cheguem em desacordo.
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const [cultos, ativa] = await Promise.all([
    cultoStore.listar(),
    cultoStore.buscarAtiva(),
  ]);
  // `podeMontar` vem daqui em vez de a tela deduzir do status da resposta:
  // ler a lista é permitido a qualquer pessoa logada, montar não.
  return Response.json({
    cultos,
    ativaId: ativa?.id ?? null,
    podeMontar: podeFazer(pessoa.papel, 'culto:escrever'),
  });
}

/**
 * Cria ou substitui a ordem daquela data. Só quem tem `culto:escrever`
 * (líder). Salvar numa data que já tem ordem sobrescreve a existente — é a
 * mesma ordem sendo corrigida, ver `culto.ts`.
 */
export async function PUT(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'culto:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode montar a ordem do culto.' },
      { status: 403 },
    );
  }

  let corpo: { data?: string; blocos?: Bloco[]; idAnterior?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  if (!corpo.data || !Array.isArray(corpo.blocos) || corpo.blocos.length === 0) {
    return Response.json(
      { erro: 'Informe a data e ao menos um bloco.' },
      { status: 400 },
    );
  }

  // A data vira o id do documento: uma data malformada criaria um id
  // esquisito e quebraria a ordenação e a comparação com "hoje".
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corpo.data)) {
    return Response.json({ erro: 'Data inválida.' }, { status: 400 });
  }

  const culto = await cultoStore.salvar(
    { data: corpo.data, blocos: corpo.blocos },
    pessoa.nome,
  );

  // Trocar a data de uma ordem existente MOVE a ordem: sem isto, corrigir a
  // data deixaria a original órfã na data errada, como se fosse um culto a
  // mais. O id é a própria data, então "mover" é gravar no novo e apagar o
  // antigo.
  if (corpo.idAnterior && corpo.idAnterior !== culto.id) {
    await cultoStore.remover(corpo.idAnterior);
  }

  return Response.json({ culto });
}

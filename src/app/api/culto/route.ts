import { cultoStore } from '@/lib/culto-store';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import type { Bloco } from '@/lib/culto';

export const dynamic = 'force-dynamic';

/** A Ordem do Culto de hoje, ou null se ninguém montou ainda. */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const culto = await cultoStore.buscar();
  return Response.json({ culto });
}

/** Substitui a sequência do culto. Só quem tem `culto:escrever` (líder). */
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

  let corpo: { data?: string; blocos?: Bloco[] };
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

  const culto = await cultoStore.salvar(
    { data: corpo.data, blocos: corpo.blocos },
    pessoa.nome,
  );
  return Response.json({ culto });
}

import { pessoasStore } from '@/lib/pessoas-store';
import { podeFazer, type Papel } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

const PAPEIS_VALIDOS: Papel[] = ['admin', 'lider', 'coordenador', 'operador'];

/** Atualiza papéis e áreas visíveis de uma pessoa já cadastrada. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'pessoas:escrever')) {
    return Response.json({ erro: 'Seu papel não pode editar pessoas.' }, { status: 403 });
  }

  let corpo: { papel?: string; departamento?: string; areasVisiveis?: string[] };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const papel = PAPEIS_VALIDOS.includes(corpo.papel as Papel) ? (corpo.papel as Papel) : null;
  if (!papel) {
    return Response.json({ erro: 'Escolha um papel.' }, { status: 400 });
  }

  const { uid } = await params;
  await pessoasStore.atualizar(uid, {
    papel,
    departamento: corpo.departamento || undefined,
    areasVisiveis: corpo.areasVisiveis ?? [],
  });
  return Response.json({ ok: true });
}

/** Remove o acesso de uma pessoa (a conta de login em si permanece). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'pessoas:escrever')) {
    return Response.json({ erro: 'Seu papel não pode remover pessoas.' }, { status: 403 });
  }

  const { uid } = await params;
  if (uid === pessoa.uid) {
    return Response.json(
      { erro: 'Você não pode remover o próprio acesso.' },
      { status: 400 },
    );
  }

  await pessoasStore.remover(uid);
  return Response.json({ ok: true });
}

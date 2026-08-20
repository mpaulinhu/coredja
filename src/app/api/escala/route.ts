import { escalaStore } from '@/lib/escala-store';
import type { Escalado } from '@/lib/escala';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/** A escala de hoje, ou null se ninguém montou ainda. */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const escala = await escalaStore.buscar();
  return Response.json({ escala });
}

/** Substitui a escala. Só quem tem `escala:escrever` (coordenador). */
export async function PUT(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'escala:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode montar a escala.' },
      { status: 403 },
    );
  }

  let corpo: { data?: string; escalados?: Omit<Escalado, 'presente'>[] };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  if (!corpo.data || !Array.isArray(corpo.escalados) || corpo.escalados.length === 0) {
    return Response.json(
      { erro: 'Informe a data e ao menos uma pessoa escalada.' },
      { status: 400 },
    );
  }

  const escala = await escalaStore.salvar(
    { data: corpo.data, escalados: corpo.escalados },
    pessoa.nome,
  );
  return Response.json({ escala });
}

import { AREAS } from '@/lib/areas';
import { pessoasStore } from '@/lib/pessoas-store';
import { podeFazer, type Papel } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

const PAPEIS_VALIDOS: Papel[] = ['admin', 'lider', 'coordenador', 'operador'];

/**
 * Todas as pessoas com conta no Coredja, mais a lista de áreas para montar
 * os checkboxes de `areasVisiveis` na tela. Só quem tem `pessoas:escrever`
 * (admin).
 *
 * As áreas vêm sem o `token` — `AREAS` de `areas.ts` inclui o campo no tipo,
 * mas aqui só repassamos slug/nome/cor: o token nunca deve chegar ao
 * navegador de uma pessoa, só ao link secreto de cada área.
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papeis, 'pessoas:escrever')) {
    return Response.json({ erro: 'Seu papel não pode ver esta lista.' }, { status: 403 });
  }

  const pessoas = await pessoasStore.listar();
  const areas = AREAS.map(({ slug, nome, cor }) => ({ slug, nome, cor }));
  return Response.json({ pessoas, areas });
}

/** Convida uma pessoa nova — cria login (se preciso) e a ficha de acesso. */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papeis, 'pessoas:escrever')) {
    return Response.json({ erro: 'Seu papel não pode convidar pessoas.' }, { status: 403 });
  }

  let corpo: { nome?: string; email?: string; papeis?: string[]; areasVisiveis?: string[] };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const nome = (corpo.nome ?? '').trim();
  const email = (corpo.email ?? '').trim().toLowerCase();
  const papeis = (corpo.papeis ?? []).filter((p): p is Papel =>
    PAPEIS_VALIDOS.includes(p as Papel),
  );
  const areasVisiveis = corpo.areasVisiveis ?? [];

  if (!nome || !email) {
    return Response.json({ erro: 'Informe nome e e-mail.' }, { status: 400 });
  }
  if (papeis.length === 0) {
    return Response.json({ erro: 'Escolha ao menos um papel.' }, { status: 400 });
  }

  try {
    const convidada = await pessoasStore.convidar({ nome, email, papeis, areasVisiveis });
    return Response.json({ pessoa: convidada }, { status: 201 });
  } catch (erro) {
    return Response.json(
      { erro: erro instanceof Error ? erro.message : 'Não foi possível convidar.' },
      { status: 500 },
    );
  }
}

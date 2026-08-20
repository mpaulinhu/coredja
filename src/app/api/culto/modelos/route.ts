import { cultoStore } from '@/lib/culto-store';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import type { Bloco } from '@/lib/culto';

export const dynamic = 'force-dynamic';

/**
 * Modelos salvos de sequência de blocos, para começar uma ordem nova sem
 * remontar do zero. Ler a lista é permitido a qualquer pessoa que possa
 * montar a ordem do culto — não tem sentido oferecer "começar de um modelo"
 * para quem nem pode montar nada.
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'culto:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode ver os modelos da ordem do culto.' },
      { status: 403 },
    );
  }

  const modelos = await cultoStore.listarModelos();
  return Response.json({ modelos });
}

/** Salva a sequência de blocos atual do editor como um modelo nomeado. */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'culto:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode salvar modelos da ordem do culto.' },
      { status: 403 },
    );
  }

  let corpo: { nome?: string; blocos?: Bloco[] };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const nome = corpo.nome?.trim();
  if (!nome || !Array.isArray(corpo.blocos) || corpo.blocos.length === 0) {
    return Response.json(
      { erro: 'Informe um nome e ao menos um bloco.' },
      { status: 400 },
    );
  }

  const modelo = await cultoStore.salvarModelo(
    { nome, blocos: corpo.blocos },
    pessoa.nome,
  );
  return Response.json({ modelo });
}

import { avisosStore } from '@/lib/avisos-store';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/** Todos os avisos cadastrados. Qualquer pessoa logada pode ver a lista. */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const avisos = await avisosStore.listar();
  return Response.json({ avisos });
}

/** Cadastra um aviso novo. Só quem tem `avisos:escrever` (líder). */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papeis, 'avisos:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode cadastrar avisos.' },
      { status: 403 },
    );
  }

  let corpo: { titulo?: string; texto?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const titulo = (corpo.titulo ?? '').trim();
  const texto = (corpo.texto ?? '').trim();
  if (!titulo) {
    return Response.json({ erro: 'Informe o título do aviso.' }, { status: 400 });
  }

  const aviso = await avisosStore.criar({ titulo, texto }, pessoa.nome);
  return Response.json({ aviso }, { status: 201 });
}

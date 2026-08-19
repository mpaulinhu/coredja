import { avisosStore } from '@/lib/avisos-store';
import { podeFazer, type Papel } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Põe/tira um aviso do telão. Rota própria, separada de `POST /api/avisos`,
 * pela mesma razão de `culto/avancar`: a permissão é outra — quem opera no
 * domingo publica sem precisar poder cadastrar ou apagar aviso.
 */
function podeOperarTelao(papeis: Papel[]): boolean {
  return podeFazer(papeis, 'avisos:publicar') || podeFazer(papeis, 'avisos:escrever');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeOperarTelao(pessoa.papeis)) {
    return Response.json({ erro: 'Seu papel não pode publicar no telão.' }, { status: 403 });
  }

  const { id } = await params;
  const avisos = await avisosStore.publicar(id);
  return Response.json({ avisos });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeOperarTelao(pessoa.papeis)) {
    return Response.json({ erro: 'Seu papel não pode alterar o telão.' }, { status: 403 });
  }

  const { id } = await params;
  const avisos = await avisosStore.ocultar(id);
  return Response.json({ avisos });
}

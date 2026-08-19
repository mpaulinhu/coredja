import { escalaStore } from '@/lib/escala-store';
import { podeFazer, type Papel } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Marca presença/ausência de uma pessoa escalada. Rota própria, separada de
 * `PUT /api/escala`, pela mesma razão de `culto/avancar` e
 * `avisos/[id]/telao`: permissão diferente — quem opera no domingo confirma
 * presença sem poder reescrever a escala que o coordenador montou.
 */
function podeConfirmarPresenca(papeis: Papel[]): boolean {
  return podeFazer(papeis, 'escala:presenca') || podeFazer(papeis, 'escala:escrever');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeConfirmarPresenca(pessoa.papeis)) {
    return Response.json(
      { erro: 'Seu papel não pode confirmar presença.' },
      { status: 403 },
    );
  }

  let corpo: { presente?: boolean };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const { id } = await params;
  const escala = await escalaStore.marcarPresenca(id, Boolean(corpo.presente));
  if (!escala) {
    return Response.json({ erro: 'Nenhuma escala montada ainda.' }, { status: 404 });
  }
  return Response.json({ escala });
}

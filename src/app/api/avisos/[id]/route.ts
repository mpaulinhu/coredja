import { avisosStore } from '@/lib/avisos-store';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/** Remove um aviso cadastrado. Só quem tem `avisos:escrever` (líder). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papeis, 'avisos:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode remover avisos.' },
      { status: 403 },
    );
  }

  const { id } = await params;
  await avisosStore.remover(id);
  return Response.json({ ok: true });
}

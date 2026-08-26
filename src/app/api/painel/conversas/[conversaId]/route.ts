import { publicar } from '@/lib/eventos';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Apaga TODOS os recados de uma conversa.
 *
 * É a limpeza de fim de culto: acabou o domingo, a conversa com aquele
 * departamento pode ir embora inteira. Diferente de resolver um por um, que
 * só tira da lista ativa e guarda no histórico para sempre.
 *
 * Apaga pendentes junto com resolvidos, de propósito — "limpar a conversa"
 * que deixasse recado para trás não limparia nada, e quem clica aqui está
 * dizendo que aquele assunto acabou. A tela confirma antes, porque não há
 * como desfazer.
 *
 * Trava de administração (`departamentos:escrever`), não a de operar o
 * painel: quem está na cabine no domingo mexe em recado o tempo todo, e uma
 * ação irreversível com a mesma permissão do dia a dia é fácil de errar ao
 * vivo.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ conversaId: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'departamentos:escrever')) {
    return Response.json(
      { erro: 'Só quem administra o Coredja limpa a conversa.' },
      { status: 403 },
    );
  }

  const { conversaId } = await params;
  const [deptoA, deptoB] = decodeURIComponent(conversaId).split('__');
  if (!deptoA || !deptoB) {
    return Response.json({ erro: 'Conversa inválida.' }, { status: 400 });
  }

  const apagados = await store.apagarConversa(decodeURIComponent(conversaId));
  publicar('conversa-apagada', decodeURIComponent(conversaId));

  return Response.json({ apagados });
}

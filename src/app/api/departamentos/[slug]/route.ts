import {
  ehSlugReservado,
  problemaNaCor,
  problemaNoNome,
} from '@/lib/departamento-validacao';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Atualiza nome e cor de um departamento. Só quem tem
 * `departamentos:escrever` (admin).
 *
 * O slug NÃO muda: ele é a identidade do departamento e está gravado dentro
 * do `conversaId` de toda mensagem do histórico (ver `idDaConversa`).
 * Renomeá-lo deixaria as conversas antigas apontando para um departamento
 * que não existe mais. Nome e cor são só exibição — mudam à vontade,
 * inclusive no departamento reservado.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'departamentos:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode editar departamentos.' },
      { status: 403 },
    );
  }

  let corpo: { nome?: string; cor?: string; slug?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const { slug } = await params;

  if (corpo.slug !== undefined && corpo.slug !== slug) {
    return Response.json(
      {
        erro:
          'O endereço de um departamento não pode ser trocado — ele identifica ' +
          'as conversas já gravadas. Crie um novo departamento se precisar de outro endereço.',
      },
      { status: 400 },
    );
  }

  const nome = (corpo.nome ?? '').trim();
  const cor = (corpo.cor ?? '').trim();

  const erroNome = problemaNoNome(nome);
  if (erroNome) return Response.json({ erro: erroNome }, { status: 400 });

  const erroCor = problemaNaCor(cor);
  if (erroCor) return Response.json({ erro: erroCor }, { status: 400 });

  const atualizado = await store.atualizarDepartamento(slug, { nome, cor });
  if (!atualizado) {
    return Response.json({ erro: 'Departamento não encontrado.' }, { status: 404 });
  }

  return Response.json({ departamento: atualizado });
}

/**
 * Apaga um departamento. Só quem tem `departamentos:escrever` (admin).
 *
 * Não bloqueia por histórico: as mensagens antigas continuam no banco
 * referenciando um slug que saiu da lista, e `montarConversas` simplesmente
 * pula a conversa cujo departamento não existe mais.
 *
 * A recusa do slug reservado é feita aqui, no servidor: a tela também
 * esconde o botão, mas isso é conveniência — a garantia é esta.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'departamentos:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode apagar departamentos.' },
      { status: 403 },
    );
  }

  const { slug } = await params;

  if (ehSlugReservado(slug)) {
    return Response.json(
      {
        erro:
          'O Audiovisual não pode ser apagado: é ele que dá o aparato de urgência ' +
          '(recado urgente, pendente e resolvido) às conversas.',
      },
      { status: 400 },
    );
  }

  const existente = await store.buscarDepartamento(slug);
  if (!existente) {
    return Response.json({ erro: 'Departamento não encontrado.' }, { status: 404 });
  }

  await store.removerDepartamento(slug);
  return Response.json({ ok: true });
}

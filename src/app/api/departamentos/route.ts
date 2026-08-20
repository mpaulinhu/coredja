import {
  problemaNaCor,
  problemaNoNome,
  problemaNoSlug,
  slugDoNome,
} from '@/lib/departamento-validacao';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Os departamentos cadastrados.
 *
 * Basta estar logado: todo mundo precisa da lista para saber com quem pode
 * conversar. Só criar/editar/apagar exige `departamentos:escrever` (admin).
 *
 * `podeEditar` vem junto pelo mesmo motivo que `podeMontar` em
 * `GET /api/culto`: como esta rota responde 200 para qualquer pessoa logada,
 * a tela não tem como deduzir a permissão pelo status — e reimplementar a
 * regra no navegador criaria uma segunda fonte de verdade.
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const departamentos = await store.listarDepartamentos();
  return Response.json({
    departamentos,
    podeEditar: podeFazer(pessoa.papel, 'departamentos:escrever'),
  });
}

/** Cria um departamento novo. Só quem tem `departamentos:escrever` (admin). */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'departamentos:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode criar departamentos.' },
      { status: 403 },
    );
  }

  let corpo: { nome?: string; cor?: string; slug?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const nome = (corpo.nome ?? '').trim();
  const cor = (corpo.cor ?? '').trim();

  const erroNome = problemaNoNome(nome);
  if (erroNome) return Response.json({ erro: erroNome }, { status: 400 });

  const erroCor = problemaNaCor(cor);
  if (erroCor) return Response.json({ erro: erroCor }, { status: 400 });

  // O slug informado vence o derivado do nome, mas passa pela mesma
  // normalização: um slug digitado à mão com acento ou espaço quebraria o
  // `conversaId` do mesmo jeito que um gerado sem cuidado.
  const slug = slugDoNome(corpo.slug?.trim() || nome);
  const erroSlug = problemaNoSlug(slug);
  if (erroSlug) return Response.json({ erro: erroSlug }, { status: 400 });

  const jaExiste = await store.buscarDepartamento(slug);
  if (jaExiste) {
    return Response.json(
      { erro: `Já existe um departamento com o endereço "${slug}".` },
      { status: 409 },
    );
  }

  const departamento = await store.criarDepartamento({ slug, nome, cor });
  return Response.json({ departamento }, { status: 201 });
}

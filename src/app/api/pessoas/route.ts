import { pessoasStore } from '@/lib/pessoas-store';
import { podeFazer, type Papel } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

const PAPEIS_VALIDOS: Papel[] = ['admin', 'lider', 'operador'];

/**
 * Todas as pessoas com conta no Coredja, mais a lista de áreas (checkboxes
 * de `areasVisiveis`) e a lista de departamentos (seletor de
 * `departamento`). Só quem tem `pessoas:escrever` (admin).
 *
 * `areas` e `departamentos` são hoje A MESMA lista, e é de propósito. Antes,
 * `areas` vinha de `AREAS` (Cantina e Kids fixos em código) e alimentava os
 * checkboxes de `areasVisiveis`. Com o CRUD de Departamentos, isso virou um
 * bug latente: um departamento criado na tela nunca aparecia como opção de
 * conversa, porque a lista de origem era outra. O campo `areas` continua na
 * resposta só para não quebrar quem já consome — a fonte é uma só.
 *
 * `departamentos` continua vindo aqui mesmo depois de `GET
 * /api/departamentos` passar a existir: a tela de Usuários precisa das três
 * listas ao mesmo tempo para montar os seletores, e buscá-las em duas
 * requisições só acrescentaria um segundo estado de carregamento sem que
 * nada na tela ganhasse com isso. Quem quer só os departamentos (a tela de
 * Departamentos, e o menu lateral) usa a rota dedicada.
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'pessoas:escrever')) {
    return Response.json({ erro: 'Seu papel não pode ver esta lista.' }, { status: 403 });
  }

  const [pessoas, departamentos] = await Promise.all([
    pessoasStore.listar(),
    store.listarDepartamentos(),
  ]);
  // Mesma lista nos dois campos — ver a nota acima.
  const areas = departamentos.map(({ slug, nome, cor }) => ({ slug, nome, cor }));
  return Response.json({ pessoas, areas, departamentos });
}

/** Convida uma pessoa nova — cria login (se preciso) e a ficha de acesso. */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'pessoas:escrever')) {
    return Response.json({ erro: 'Seu papel não pode convidar pessoas.' }, { status: 403 });
  }

  let corpo: {
    nome?: string;
    email?: string;
    papel?: string;
    departamento?: string;
    areasVisiveis?: string[];
    abas?: string[];
  };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const nome = (corpo.nome ?? '').trim();
  const email = (corpo.email ?? '').trim().toLowerCase();
  const papel = PAPEIS_VALIDOS.includes(corpo.papel as Papel) ? (corpo.papel as Papel) : null;
  const departamento = corpo.departamento || undefined;
  const areasVisiveis = corpo.areasVisiveis ?? [];
  // Ausente = padrão do cargo. Ver `abas` em `Pessoa`.
  const abas = Array.isArray(corpo.abas) ? corpo.abas : undefined;

  if (!nome || !email) {
    return Response.json({ erro: 'Informe nome e e-mail.' }, { status: 400 });
  }
  if (!papel) {
    return Response.json({ erro: 'Escolha um papel.' }, { status: 400 });
  }

  try {
    const convidada = await pessoasStore.convidar({
      nome,
      email,
      papel,
      departamento,
      areasVisiveis,
      abas,
    });
    return Response.json({ pessoa: convidada }, { status: 201 });
  } catch (erro) {
    return Response.json(
      { erro: erro instanceof Error ? erro.message : 'Não foi possível convidar.' },
      { status: 500 },
    );
  }
}

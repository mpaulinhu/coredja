import { AREAS } from '@/lib/areas';
import { pessoasStore } from '@/lib/pessoas-store';
import { podeFazer, type Papel } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

const PAPEIS_VALIDOS: Papel[] = ['admin', 'lider', 'coordenador', 'operador'];

/**
 * Todas as pessoas com conta no Coredja, mais a lista de áreas (checkboxes
 * de `areasVisiveis`) e a lista de departamentos (seletor de
 * `departamento`). Só quem tem `pessoas:escrever` (admin).
 *
 * As áreas vêm sem o `token` — `AREAS` de `areas.ts` inclui o campo no tipo,
 * mas aqui só repassamos slug/nome/cor: o token nunca deve chegar ao
 * navegador de uma pessoa, só ao link secreto de cada área.
 *
 * `departamentos` reaproveita o padrão que já devolvia `{ pessoas, areas }`
 * — a tela de Departamentos (Etapa 4, fora do escopo desta mudança) ainda
 * não tem rota própria, e criar `GET /api/departamentos` só para isso seria
 * mais uma rota para uma chamada que esta já faz de qualquer forma.
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
  const areas = AREAS.map(({ slug, nome, cor }) => ({ slug, nome, cor }));
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
    });
    return Response.json({ pessoa: convidada }, { status: 201 });
  } catch (erro) {
    return Response.json(
      { erro: erro instanceof Error ? erro.message : 'Não foi possível convidar.' },
      { status: 500 },
    );
  }
}

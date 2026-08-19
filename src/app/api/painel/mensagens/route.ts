import { montarConversas } from '@/lib/conversas';
import { publicar } from '@/lib/eventos';
import { TAMANHO_MAXIMO_TEXTO } from '@/lib/limites';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { store } from '@/lib/store';
import type { Prioridade } from '@/lib/types';

/**
 * Dados do painel do audiovisual e envio de respostas para as áreas.
 *
 * Protegido por login desde a adição de `areasVisiveis` (ver `papeis.ts`):
 * antes disso o painel era a única rota interna sem checagem de sessão,
 * porque não existia login quando ela foi escrita — furo que ficou para
 * trás. `areasVisiveis` só faz sentido junto com autenticação: sem saber
 * quem está pedindo, não há o que filtrar.
 */

export const dynamic = 'force-dynamic';

/** As conversas das áreas que esta pessoa pode ver, prontas para o painel. */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  return Response.json({ conversas: await montarConversas(pessoa.areasVisiveis) });
}

/** Resposta do audiovisual para uma área. */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  let corpo: { areaSlug?: unknown; texto?: unknown; prioridade?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const areaSlug = String(corpo.areaSlug ?? '');
  const texto = String(corpo.texto ?? '').trim();
  const prioridade: Prioridade =
    corpo.prioridade === 'urgente' ? 'urgente' : 'normal';

  if (!pessoa.areasVisiveis?.includes(areaSlug)) {
    return Response.json(
      { erro: 'Você não tem acesso a esta área.' },
      { status: 403 },
    );
  }

  const area = await store.buscarArea(areaSlug);
  if (!area) {
    return Response.json({ erro: 'Área não encontrada.' }, { status: 404 });
  }

  if (!texto) {
    return Response.json({ erro: 'Escreva a mensagem.' }, { status: 400 });
  }

  if (texto.length > TAMANHO_MAXIMO_TEXTO) {
    return Response.json(
      { erro: `A mensagem passa de ${TAMANHO_MAXIMO_TEXTO} caracteres.` },
      { status: 400 },
    );
  }

  const mensagem = await store.criarMensagem({
    areaSlug: area.slug,
    autor: 'audiovisual',
    texto,
    prioridade,
    anexos: [],
  });

  publicar('mensagem-nova', area.slug);

  return Response.json({ mensagem }, { status: 201 });
}

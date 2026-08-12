import { montarConversas } from '@/lib/conversas';
import { publicar } from '@/lib/eventos';
import { TAMANHO_MAXIMO_TEXTO } from '@/lib/limites';
import { store } from '@/lib/store';
import type { Prioridade } from '@/lib/types';

/**
 * Dados do painel do audiovisual e envio de respostas para as áreas.
 */

export const dynamic = 'force-dynamic';

/** As conversas, uma por área, com tudo que o painel precisa para desenhar. */
export async function GET() {
  return Response.json({ conversas: await montarConversas() });
}

/** Resposta do audiovisual para uma área. */
export async function POST(request: Request) {
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

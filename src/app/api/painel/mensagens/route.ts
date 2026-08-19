import { conversaTemUrgencia, montarConversas } from '@/lib/conversas';
import { publicar } from '@/lib/eventos';
import { TAMANHO_MAXIMO_TEXTO } from '@/lib/limites';
import { podeConversarCom } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { store } from '@/lib/store';
import type { Prioridade } from '@/lib/types';

/**
 * Dados do painel e envio de mensagens entre departamentos.
 *
 * Protegido por login desde a adição de `areasVisiveis` (ver `papeis.ts`):
 * antes disso o painel era a única rota interna sem checagem de sessão,
 * porque não existia login quando ela foi escrita — furo que ficou para
 * trás. `areasVisiveis`/`departamento` só fazem sentido junto com
 * autenticação: sem saber quem está pedindo, não há o que filtrar.
 */

export const dynamic = 'force-dynamic';

/**
 * As conversas que esta pessoa pode ver, prontas para o painel.
 *
 * Devolve também o departamento de quem pediu: o painel precisa dele para
 * saber qual das duas pontas de cada conversa é "o outro lado" a exibir (ver
 * `outroLado` em `PainelAudiovisual.tsx`).
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  return Response.json({
    conversas: await montarConversas(pessoa),
    meuDepartamento: pessoa.departamento ?? null,
  });
}

/** Envia uma mensagem numa conversa entre dois departamentos. */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  if (!pessoa.departamento) {
    return Response.json(
      { erro: 'Pessoa sem departamento atribuído.' },
      { status: 400 },
    );
  }

  let corpo: { conversaId?: unknown; texto?: unknown; prioridade?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const conversaId = String(corpo.conversaId ?? '');
  const texto = String(corpo.texto ?? '').trim();

  const [deptoA, deptoB] = conversaId.split('__');
  if (!deptoA || !deptoB) {
    return Response.json({ erro: 'Conversa inválida.' }, { status: 400 });
  }

  // Duas condições: a conversa precisa ser minha (sou uma das pontas) e o
  // outro lado precisa estar liberado para mim pelo admin.
  const souPonta = pessoa.departamento === deptoA || pessoa.departamento === deptoB;
  const outro = pessoa.departamento === deptoA ? deptoB : deptoA;
  const liberados = podeConversarCom(
    pessoa,
    (await store.listarDepartamentos()).map((d) => d.slug),
  );

  if (!souPonta || !liberados.includes(outro)) {
    return Response.json(
      { erro: 'Você não pode conversar com este departamento.' },
      { status: 403 },
    );
  }

  // O client pode mandar 'urgente' mesmo numa conversa sem Audiovisual (ex:
  // UI desatualizada) — o servidor rebaixa para null em vez de rejeitar, já
  // que "normal" é sempre um valor válido e o pior caso de aceitar é a
  // mensagem perder um destaque que não faria sentido ali de qualquer forma.
  const prioridade: Prioridade | null =
    corpo.prioridade === 'urgente' && conversaTemUrgencia(deptoA, deptoB)
      ? 'urgente'
      : null;

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
    conversaId,
    remetente: pessoa.departamento,
    texto,
    prioridade,
    anexos: [],
  });

  publicar('mensagem-nova', conversaId);

  return Response.json({ mensagem }, { status: 201 });
}

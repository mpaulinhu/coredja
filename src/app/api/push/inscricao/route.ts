import { pushConfigurado, removerInscricao, salvarInscricao } from '@/lib/push';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Registra o aparelho de quem está logado para receber notificação.
 *
 * A inscrição é criada pelo NAVEGADOR (`pushManager.subscribe`) e mandada
 * para cá só para ser guardada — o servidor não escolhe o endereço, apenas
 * anota de quem ele é. Por isso o `uid` vem da sessão e nunca do corpo: sem
 * isso qualquer pessoa logada poderia inscrever o próprio aparelho no nome
 * de outra e receber os recados dela.
 */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!pushConfigurado()) {
    return Response.json(
      { erro: 'Notificações não estão configuradas neste servidor.' },
      { status: 503 },
    );
  }

  let corpo: {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const endpoint = typeof corpo.endpoint === 'string' ? corpo.endpoint : '';
  const p256dh = typeof corpo.keys?.p256dh === 'string' ? corpo.keys.p256dh : '';
  const auth = typeof corpo.keys?.auth === 'string' ? corpo.keys.auth : '';
  if (!endpoint || !p256dh || !auth) {
    return Response.json({ erro: 'Inscrição incompleta.' }, { status: 400 });
  }

  await salvarInscricao({
    endpoint,
    keys: { p256dh, auth },
    uid: pessoa.uid,
    departamento: pessoa.departamento,
  });

  return Response.json({ ok: true });
}

/** Desliga a notificação neste aparelho. */
export async function DELETE(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  let corpo: { endpoint?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const endpoint = typeof corpo.endpoint === 'string' ? corpo.endpoint : '';
  if (!endpoint) {
    return Response.json({ erro: 'Endpoint ausente.' }, { status: 400 });
  }

  await removerInscricao(endpoint);
  return Response.json({ ok: true });
}

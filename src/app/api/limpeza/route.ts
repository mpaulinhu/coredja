import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Quantos dias um recado resolvido fica guardado antes de sumir sozinho.
 *
 * 60 dias cobre com folga o "preciso conferir o que foi pedido no mês
 * passado" e ainda assim impede que a conversa vire um arquivo histórico de
 * anos. Só conta a partir de quando foi RESOLVIDO — recado pendente nunca é
 * apagado por tempo, por mais antigo que seja: se ninguém resolveu, ainda
 * importa para alguém.
 */
const DIAS_PARA_GUARDAR = 60;

/**
 * Limpeza automática, chamada uma vez por dia pelo cron da Vercel
 * (ver `crons` em `vercel.json`).
 *
 * Existe porque as outras duas formas de apagar dependem de alguém lembrar:
 * o botão de limpar conversa e o de apagar um recado só rodam quando têm
 * um clique atrás. Sem esta varredura, a conversa que ninguém limpou
 * cresce para sempre.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUEM PODE CHAMAR
 * ────────────────────────────────────────────────────────────────────────────
 * A Vercel manda `Authorization: Bearer $CRON_SECRET` nas chamadas de cron
 * quando essa variável existe no projeto. Sem a variável configurada, a rota
 * recusa tudo — falhar fechado é o certo aqui: uma rota de apagar aberta na
 * internet é pior que uma limpeza que não roda.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return Response.json(
      { erro: 'CRON_SECRET não configurado neste servidor.' },
      { status: 503 },
    );
  }
  if (request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return Response.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const apagados = await store.apagarResolvidosAntigos(DIAS_PARA_GUARDAR);
  return Response.json({ apagados, dias: DIAS_PARA_GUARDAR });
}

import { inscrever } from '@/lib/eventos';

/**
 * Canal de avisos em tempo real (Server-Sent Events).
 *
 * A tela abre esta rota e a conexão fica aberta. A cada recado enviado ou
 * resolvido, o servidor empurra uma linha por aqui e a tela se atualiza
 * sozinha. O navegador reconecta por conta própria se a conexão cair — é o
 * comportamento nativo do EventSource, e o motivo de usar SSE em vez de
 * WebSocket: numa rede Wi-Fi de igreja, quedas curtas são esperadas.
 */

// A rota precisa manter a conexão viva; não pode ser pré-renderizada.
export const dynamic = 'force-dynamic';

/** Sem tráfego, um proxy ou o Wi-Fi podem encerrar a conexão ociosa. */
const INTERVALO_KEEPALIVE_MS = 25_000;

export async function GET(request: Request) {
  const codificador = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let aberto = true;

      const enviar = (texto: string) => {
        if (!aberto) return;
        try {
          controller.enqueue(codificador.encode(texto));
        } catch {
          // A tela fechou entre a checagem e o envio; o cleanup cuida do resto.
          aberto = false;
        }
      };

      // Primeiro byte imediato: alguns navegadores só consideram a conexão
      // estabelecida depois de receber algo.
      enviar(': conectado\n\n');

      const cancelarInscricao = inscrever((evento) => {
        enviar(`data: ${JSON.stringify(evento)}\n\n`);
      });

      const keepalive = setInterval(() => {
        enviar(': keepalive\n\n');
      }, INTERVALO_KEEPALIVE_MS);

      const encerrar = () => {
        if (!aberto) return;
        aberto = false;
        clearInterval(keepalive);
        cancelarInscricao();
        try {
          controller.close();
        } catch {
          // Já fechado pelo navegador.
        }
      };

      request.signal.addEventListener('abort', encerrar);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Desliga o buffer de proxies, que seguraria os avisos até acumular.
      'X-Accel-Buffering': 'no',
    },
  });
}

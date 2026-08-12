'use client';

import { useEffect, useRef } from 'react';
import type { Evento } from '@/lib/eventos';

/**
 * Escuta os avisos do servidor e chama `aoReceber` a cada mudança.
 *
 * O EventSource reconecta sozinho se a conexão cair — comum num Wi-Fi de
 * igreja — então não há lógica de retentativa aqui.
 */
export function useEventos(aoReceber: (evento: Evento) => void): void {
  // A função de callback costuma ser recriada a cada render; guardá-la numa ref
  // evita fechar e reabrir a conexão a cada atualização da tela.
  const callback = useRef(aoReceber);

  useEffect(() => {
    callback.current = aoReceber;
  }, [aoReceber]);

  useEffect(() => {
    const fonte = new EventSource('/api/eventos');

    fonte.onmessage = (evento) => {
      try {
        callback.current(JSON.parse(evento.data) as Evento);
      } catch {
        // Linha malformada: ignorar é melhor que derrubar a tela.
      }
    };

    return () => fonte.close();
  }, []);
}

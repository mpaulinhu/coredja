'use client';

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useRef } from 'react';
import type { Evento } from '@/lib/eventos';
import { firebaseConfigurado, getFirestoreCliente } from '@/lib/firebase-cliente';

/**
 * Avisa quando algum recado muda, para a tela se atualizar sozinha.
 *
 * Dois mecanismos, escolhidos automaticamente:
 *
 * 1. **Firestore** — o navegador escuta o banco direto. Funciona em qualquer
 *    lugar, inclusive com a plataforma hospedada, onde pode haver mais de um
 *    servidor atendendo.
 *
 * 2. **SSE** — um canal aberto com o servidor, usado quando o Firebase não
 *    está configurado (armazenamento local no PC do audiovisual). Só funciona
 *    com um servidor único, que é exatamente o caso dessa instalação.
 *
 * A distinção existe porque o SSE guarda os ouvintes na memória do processo:
 * com vários servidores, quem enviou o recado avisa apenas as telas ligadas
 * naquele processo, e as demais nunca ficam sabendo.
 *
 * `areaSlug` limita a escuta a uma área — a tela da Cantina não precisa
 * acordar quando o Kids manda recado.
 */
export function useEventos(
  aoReceber: (evento: Evento) => void,
  areaSlug?: string,
): void {
  // A função de callback costuma ser recriada a cada render; guardá-la numa ref
  // evita refazer a inscrição a cada atualização da tela.
  const callback = useRef(aoReceber);

  useEffect(() => {
    callback.current = aoReceber;
  }, [aoReceber]);

  useEffect(() => {
    const db = getFirestoreCliente();

    // --- Caminho 1: escuta o Firestore direto -----------------------------
    if (db) {
      const alvo = areaSlug
        ? query(collection(db, 'mensagens'), where('areaSlug', '==', areaSlug))
        : collection(db, 'mensagens');

      let primeira = true;

      return onSnapshot(
        alvo,
        (snapshot) => {
          // A primeira resposta traz tudo que já existe; avisar nela faria a
          // tela recarregar à toa (e tocaria o som ao abrir o painel).
          if (primeira) {
            primeira = false;
            return;
          }
          if (snapshot.docChanges().length === 0) return;

          // Um aviso por lote: quem recebe relê os dados do servidor de
          // qualquer forma, então detalhar cada documento não ajudaria.
          callback.current({
            tipo: 'mensagem-nova',
            areaSlug: areaSlug ?? '',
            em: new Date().toISOString(),
          });
        },
        () => {
          // Sem permissão ou sem rede: a releitura periódica de quem usa este
          // hook mantém a tela correta, então não há o que fazer aqui.
        },
      );
    }

    // --- Caminho 2: canal com o servidor (instalação local) ---------------
    const fonte = new EventSource('/api/eventos');

    fonte.onmessage = (evento) => {
      try {
        const dados = JSON.parse(evento.data) as Evento;
        if (areaSlug && dados.areaSlug !== areaSlug) return;
        callback.current(dados);
      } catch {
        // Linha malformada: ignorar é melhor que derrubar a tela.
      }
    };

    return () => fonte.close();
  }, [areaSlug]);
}

/** Qual mecanismo está em uso. Exposto para a home mostrar o estado. */
export function tempoRealPorFirestore(): boolean {
  return firebaseConfigurado();
}

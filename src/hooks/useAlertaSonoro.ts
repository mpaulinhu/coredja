'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Aviso sonoro de recado novo.
 *
 * O som é gerado pelo próprio navegador (Web Audio), sem arquivo de áudio:
 * um arquivo teria de ser baixado e poderia falhar justamente no momento em
 * que o aviso importa. Dois tons curtos para recado normal, três mais agudos
 * e repetidos para urgente.
 *
 * Navegadores bloqueiam áudio até a pessoa interagir com a página. Por isso
 * `liberar()` deve ser chamado no primeiro clique — é o que destrava o som
 * para o resto da sessão.
 */
export function useAlertaSonoro(ativo: boolean) {
  const contexto = useRef<AudioContext | null>(null);

  const obterContexto = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!contexto.current) {
      const Construtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Construtor) return null;
      contexto.current = new Construtor();
    }
    return contexto.current;
  }, []);

  /** Destrava o áudio. Chamar em resposta a um clique real da pessoa. */
  const liberar = useCallback(() => {
    const ctx = obterContexto();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }, [obterContexto]);

  const tocar = useCallback(
    (urgente: boolean) => {
      if (!ativo) return;
      const ctx = obterContexto();
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();

      const frequencias = urgente ? [880, 1180, 880] : [660, 880];
      const duracao = 0.14;
      const intervalo = urgente ? 0.19 : 0.17;

      frequencias.forEach((frequencia, indice) => {
        const inicio = ctx.currentTime + indice * intervalo;

        const oscilador = ctx.createOscillator();
        const volume = ctx.createGain();

        oscilador.type = 'sine';
        oscilador.frequency.setValueAtTime(frequencia, inicio);

        // Ataque e queda suaves: um ganho ligado de uma vez estala no alto-falante.
        volume.gain.setValueAtTime(0, inicio);
        volume.gain.linearRampToValueAtTime(urgente ? 0.28 : 0.18, inicio + 0.015);
        volume.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);

        oscilador.connect(volume);
        volume.connect(ctx.destination);

        oscilador.start(inicio);
        oscilador.stop(inicio + duracao + 0.02);
      });
    },
    [ativo, obterContexto],
  );

  useEffect(() => {
    return () => {
      void contexto.current?.close();
      contexto.current = null;
    };
  }, []);

  return { tocar, liberar };
}

'use client';

import { useEffect, useState } from 'react';

/**
 * Um `Date` que se atualiza sozinho de segundo em segundo.
 *
 * Existe para o cronômetro da Ordem do Culto: quanto falta do bloco, quanto
 * o culto está atrasado e a barra de progresso são todos DERIVADOS de "que
 * horas são agora" cruzado com o que está gravado no documento (ver
 * `culto.ts`). Nada disso vira estado próprio — o único estado que se move é
 * o relógio, e todo o resto é recalculado a partir dele no render.
 *
 * Essa escolha é o que torna o cronômetro imune a F5 e coerente entre
 * aparelhos: dois navegadores abertos na mesma ordem chegam ao mesmo número
 * porque leem o mesmo `blocoIniciadoEm` e o mesmo relógio do sistema, sem
 * nenhuma contagem acumulada na memória de uma aba específica.
 *
 * Sobre o lint (`react-hooks/set-state-in-effect`): todo `setAgora` acontece
 * dentro de um callback assíncrono (`setInterval` ou `setTimeout`), nunca no
 * corpo do efeito — o efeito só agenda e limpa. É por isso que o acerto
 * imediato ao (re)ativar usa um `setTimeout(…, 0)` em vez de uma chamada
 * direta: uma chamada síncrona ali dispararia o render em cascata que a
 * regra existe para impedir.
 *
 * `ativo` desliga o intervalo quando não há o que contar (culto pausado, ou
 * nenhum bloco em andamento): sem isso a tela continuaria re-renderizando
 * uma vez por segundo a noite inteira num painel que ninguém está operando.
 */
export function useRelogio(ativo = true): Date {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    if (!ativo) return;

    // Acerto imediato ao (re)ativar: sem ele a tela mostraria o horário
    // congelado de quando pausou até o primeiro tique do intervalo chegar,
    // um segundo depois — perceptível justamente no gesto de retomar.
    const imediato = setTimeout(() => setAgora(new Date()), 0);
    const id = setInterval(() => setAgora(new Date()), 1000);

    return () => {
      clearTimeout(imediato);
      clearInterval(id);
    };
  }, [ativo]);

  return agora;
}

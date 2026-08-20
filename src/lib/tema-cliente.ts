'use client';

import { useState } from 'react';

/**
 * Troca de tema claro/escuro, só no navegador.
 *
 * Mesmo padrão de `auth-cliente.ts`/`firebase-cliente.ts`: nada de servidor
 * aqui, é puramente escolha de exibição salva no aparelho de quem usa.
 *
 * A escolha do tema é sempre EXPLÍCITA e persistida (`localStorage`), nunca
 * segue o sistema operacional sozinha — importante porque o painel roda numa
 * mesa de som fixa, onde o SO pode estar configurado de um jeito que não é a
 * preferência de quem opera ali. `prefers-color-scheme` entra só como
 * palpite inicial, na primeira visita, antes de existir uma escolha salva; a
 * partir do primeiro clique no botão de tema, a escolha manda para sempre.
 */

export type Tema = 'claro' | 'escuro';

const CHAVE_ARMAZENAMENTO = 'coredja:tema';

/** Lê o tema já aplicado no `<html>` pelo script inline (ver `layout.tsx`). */
function lerTemaAtual(): Tema {
  if (typeof document === 'undefined') return 'claro';
  return document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
}

/** Aplica o tema no `<html>` e persiste a escolha para as próximas visitas. */
export function definirTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema;
  window.localStorage.setItem(CHAVE_ARMAZENAMENTO, tema);
}

/** Hook para o botão de alternar: tema atual + função para trocar. */
export function useTema(): { tema: Tema; alternarTema: () => void } {
  // Inicializador preguiçoso (função, não valor direto): roda só na primeira
  // renderização deste componente no cliente, depois do script inline do
  // <head> já ter aplicado o `data-tema` no `<html>` — por isso pode ler o
  // DOM direto aqui, sem precisar de um `useEffect` (que causaria uma
  // renderização extra em cascata só para sincronizar um valor que já está
  // certo desde o início).
  const [tema, setTema] = useState<Tema>(lerTemaAtual);

  function alternarTema() {
    const proximo: Tema = tema === 'escuro' ? 'claro' : 'escuro';
    definirTema(proximo);
    setTema(proximo);
  }

  return { tema, alternarTema };
}

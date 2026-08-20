'use client';

import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { IconeMenuHamburguer } from './IconesMenu';
import { MenuLateral } from './MenuLateral';

/**
 * Moldura das telas internas: menu lateral + conteúdo.
 *
 * Componente client próprio (em vez de deixar isso dentro de `layout.tsx`,
 * que é server component) porque o estado de "gaveta aberta/fechada" do
 * menu no celular precisa morar em algum lugar acima de `MenuLateral` — o
 * botão que abre (☰) fica na barra de topo mobile, fora da própria gaveta.
 *
 * Abaixo de `md` (breakpoint padrão do resto do projeto): a barra "Coredja +
 * ☰" fica sempre visível no topo, o menu lateral vira gaveta escondida por
 * padrão. De `md` para cima: a barra mobile some (o cabeçalho "Coredja" já
 * está dentro do próprio `MenuLateral`, sempre visível) e o menu volta a ser
 * coluna fixa — comportamento de antes, sem gaveta.
 *
 * `ROTAS_SEM_MENU` são as telas que trazem a própria navegação e por isso
 * dispensam esta moldura inteira — hoje só os Recados, cuja tela de
 * referência usa a barra da esquerda para a LISTA DE CONVERSAS, no lugar
 * exato onde o menu ficaria (ver `PainelAudiovisual.tsx`). Elas voltam para o
 * resto do app por um link próprio no topo, como a Execução do Culto faz com
 * "← Todas as ordens".
 */

/** Telas com navegação própria — ver nota acima. */
const ROTAS_SEM_MENU = ['/painel'];

export function CascaApp({ children }: { children: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const caminho = usePathname();

  if (ROTAS_SEM_MENU.some((rota) => caminho?.startsWith(rota))) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <header className="flex items-center gap-3 border-b border-borda bg-fundo-elevado px-4 py-3 md:hidden">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setMenuAberto(true)}
          className="rounded-lg p-1.5 text-texto-suave hover:bg-fundo-cartao hover:text-texto"
        >
          <IconeMenuHamburguer />
        </button>
        <span className="text-base font-bold tracking-tight text-texto">Coredja</span>
      </header>

      <MenuLateral aberto={menuAberto} aoFechar={() => setMenuAberto(false)} />

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

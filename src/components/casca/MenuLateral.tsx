'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Menu lateral do Coredja.
 *
 * A casca comum das telas internas — hoje só o Painel, mas é aqui que Ordem
 * do Culto, Avisos e Escala entram conforme forem sendo construídas. Cada
 * item aponta para uma rota dentro de `src/app/(app)/`.
 *
 * Fica fora do `(app)/layout.tsx` como componente próprio, e não dentro dele
 * direto, para o layout continuar simples de ler: ele monta a moldura, este
 * arquivo decide o que aparece nela.
 */

interface ItemDeMenu {
  href: string;
  rotulo: string;
  /** Emoji como ícone: sem dependência nova só para isto. */
  icone: string;
  /** Rotas futuras já aparecem no menu, desativadas, para o conjunto ficar
   *  visível desde já — ver nota em `EM_BREVE` abaixo. */
  emBreve?: boolean;
}

const ITENS: ItemDeMenu[] = [
  { href: '/painel', rotulo: 'Recados', icone: '💬' },
  { href: '/culto', rotulo: 'Ordem do Culto', icone: '🎵' },
  { href: '/avisos', rotulo: 'Avisos do Telão', icone: '📢' },
  // Escala do Time oculta: a igreja já usa o Voluts para isso (19/08/2026).
  // O código continua em src/app/(app)/escala/ e src/lib/escala*.ts, caso
  // um dia volte a fazer sentido — só a entrada de menu foi removida.
];

export function MenuLateral() {
  const caminho = usePathname();

  return (
    <nav
      aria-label="Menu principal"
      className="flex h-full w-64 shrink-0 flex-col border-r border-borda bg-fundo-elevado"
    >
      <div className="px-5 py-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-texto">
          Coredja
        </Link>
        <p className="mt-0.5 text-xs text-texto-fraco">
          Comunicação interna da igreja
        </p>
      </div>

      <ul className="flex flex-col gap-1 px-3">
        {ITENS.map((item) => {
          const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);

          if (item.emBreve) {
            return (
              <li key={item.href}>
                <span
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-texto-fraco opacity-60"
                  title="Ainda não construída"
                >
                  <span aria-hidden="true">{item.icone}</span>
                  {item.rotulo}
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-texto-fraco">
                    em breve
                  </span>
                </span>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  ativo
                    ? 'bg-acento/15 text-texto'
                    : 'text-texto-suave hover:bg-fundo-cartao hover:text-texto'
                }`}
              >
                <span aria-hidden="true">{item.icone}</span>
                {item.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto px-5 py-5 text-xs text-texto-fraco">
        <Link href="/" className="hover:text-texto-suave">
          ← Voltar para a home
        </Link>
      </div>
    </nav>
  );
}

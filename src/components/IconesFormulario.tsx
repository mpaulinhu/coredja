/**
 * Ícones de controle de formulário (mostrar/ocultar senha, etc), no mesmo
 * estilo "outline" de `casca/IconesMenu.tsx` — mesmo peso de traço e
 * tamanho, para os dois conjuntos lerem como um sistema só.
 */

type Props = { className?: string };

const comum = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconeOlho({ className }: Props) {
  return (
    <svg {...comum} className={className} aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function IconeOlhoFechado({ className }: Props) {
  return (
    <svg {...comum} className={className} aria-hidden="true">
      <path d="M3.5 3.5l17 17" />
      <path d="M10.6 6.1A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a13.6 13.6 0 0 1-3.1 3.8" />
      <path d="M6.2 7.7C4 9.4 2.5 12 2.5 12S6 18.5 12 18.5a8.9 8.9 0 0 0 3.4-.68" />
      <path d="M9.7 10a2.8 2.8 0 0 0 4 4" />
    </svg>
  );
}

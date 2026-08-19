/**
 * Ícones do menu lateral, como SVG de linha — não emoji.
 *
 * Emoji varia de fonte para fonte e de sistema para sistema (o "🎤" do
 * Windows não é o mesmo desenho do macOS), e é o tipo de atalho visual que
 * lê como texto-que-virou-ícone, não como ícone desenhado para o produto.
 * Estes são fixos: mesmo peso de traço (1.8px), mesmo tamanho (20px), no
 * estilo "outline" que o resto da interface já usa (setas, check, X).
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

export function IconeRecados({ className }: Props) {
  return (
    <svg {...comum} className={className} aria-hidden="true">
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </svg>
  );
}

export function IconeCulto({ className }: Props) {
  return (
    <svg {...comum} className={className} aria-hidden="true">
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

export function IconeAvisos({ className }: Props) {
  return (
    <svg {...comum} className={className} aria-hidden="true">
      <path d="M3 11v2a1 1 0 0 0 1 1h2l6 4V6L6 10H4a1 1 0 0 0-1 1Z" />
      <path d="M16 9a3 3 0 0 1 0 6" />
      <path d="M18.5 6.5a7 7 0 0 1 0 11" />
    </svg>
  );
}

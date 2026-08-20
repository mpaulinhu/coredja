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

export function IconeUsuarios({ className }: Props) {
  return (
    <svg {...comum} className={className} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.7-3.4 3-5.2 5.5-5.2s4.8 1.8 5.5 5.2" />
      <path d="M16 8.5a3 3 0 1 1 3.6 2.94" />
      <path d="M15.5 13.6c2.1.4 3.7 2 4.3 4.7" />
    </svg>
  );
}

/** Quatro blocos numa grade — "os setores", cada um seu quadrante. */
export function IconeDepartamentos({ className }: Props) {
  return (
    <svg {...comum} className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  );
}

/**
 * Ponto cheio com duas ondas saindo — o "ao vivo" que o YouTube e o
 * Instagram já usam. Deliberadamente diferente do `IconeAvisos` (que é um
 * alto-falante): os dois falam de "transmitir", e no menu eles ficam perto um
 * do outro, então precisam ser distinguíveis de relance.
 */
export function IconeAoVivo({ className }: Props) {
  return (
    <svg {...comum} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4" />
      <path d="M16.2 16.2a6 6 0 0 0 0-8.4" />
      <path d="M4.9 4.9a10 10 0 0 0 0 14.2" />
      <path d="M19.1 19.1a10 10 0 0 0 0-14.2" />
    </svg>
  );
}

/** Três traços — abre o menu no celular. */
/**
 * Engrenagem — Configurações.
 *
 * Aro externo contínuo com o eixo no centro, em vez de traços radiais saindo
 * de um círculo: a primeira tentativa desenhava oito riscos em volta de um
 * miolo e, no tamanho de 20px do menu, lia como SOL — bem ao lado de um
 * botão de tema que é literalmente um sol. O contorno fechado não tem essa
 * ambiguidade.
 */
export function IconeConfiguracoes({ className }: Props) {
  return (
    <svg {...comum} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.2 14.6a1.6 1.6 0 0 0 .32 1.76l.06.06a1.9 1.9 0 1 1-2.7 2.7l-.05-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.46v.17a1.9 1.9 0 1 1-3.8 0v-.09a1.6 1.6 0 0 0-1.04-1.46 1.6 1.6 0 0 0-1.76.32l-.06.06a1.9 1.9 0 1 1-2.7-2.7l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.46-.98h-.17a1.9 1.9 0 0 1 0-3.8h.09a1.6 1.6 0 0 0 1.46-1.04 1.6 1.6 0 0 0-.32-1.76l-.06-.06a1.9 1.9 0 1 1 2.7-2.7l.06.06a1.6 1.6 0 0 0 1.76.32h.08a1.6 1.6 0 0 0 .97-1.46v-.17a1.9 1.9 0 1 1 3.8 0v.09a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.77-.32l.05-.06a1.9 1.9 0 1 1 2.7 2.7l-.06.06a1.6 1.6 0 0 0-.32 1.76v.08a1.6 1.6 0 0 0 1.46.97h.17a1.9 1.9 0 0 1 0 3.8h-.09a1.6 1.6 0 0 0-1.46.97Z" />
    </svg>
  );
}

export function IconeMenuHamburguer({ className }: Props) {
  return (
    <svg {...comum} className={className} aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

/** X — fecha a gaveta do menu no celular. */
export function IconeFechar({ className }: Props) {
  return (
    <svg {...comum} className={className} aria-hidden="true">
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </svg>
  );
}

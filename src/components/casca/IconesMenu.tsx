/**
 * Os dois ícones de CONTROLE da gaveta do menu no celular, como SVG de linha.
 *
 * Só sobraram estes dois. Houve um ícone por item de navegação, mas a tela de
 * referência não tem nenhum — os `<a>` dela são texto puro — e com sete
 * rótulos curtos o ícone não ajudava a achar mais rápido. Estes ficam porque
 * não são decoração: são os botões de abrir e fechar a gaveta, que precisam
 * de símbolo por não terem espaço para rótulo.
 *
 * SVG e não emoji: emoji varia de fonte para fonte e de sistema para sistema
 * (o "🎤" do Windows não é o mesmo desenho do macOS), e lê como
 * texto-que-virou-ícone, não como ícone desenhado para o produto. Estes são
 * fixos: mesmo peso de traço (1.8px), mesmo tamanho (20px), no estilo
 * "outline" que o resto da interface já usa (setas, check, X).
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

/** Três traços — abre o menu no celular. */
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

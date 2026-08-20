/**
 * Peças visuais compartilhadas do Coredja.
 *
 * Nasceram da tela de referência da Ordem do Culto (20/08/2026, "faça a tela
 * exatamente assim, e use o mesmo estilo para as outras telas"): botão de
 * ação, botão secundário, selo de estado, rótulo em caixa alta e número
 * monoespaçado aparecem lá várias vezes, e vão reaparecer nas outras telas
 * conforme forem sendo trazidas para o mesmo estilo.
 *
 * Ficam aqui, e não copiados em cada tela, porque é o que evita a próxima
 * tela nascer com um laranja levemente diferente ou um raio de canto de 12px
 * onde o resto usa 14px.
 *
 * Regra que vale para todas: **só token** (`var(--...)`), nunca cor literal.
 * O tema escuro carrega a paleta da referência e o claro a tradução dela
 * (ver `globals.css`) — uma cor fixa aqui quebraria um dos dois.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Altura mínima de alvo de toque. WCAG 2.2 AA (2.5.8) pede 24px; 44px é o
 *  número do iOS HIG, e é o que a tela do domingo precisa — quem opera está
 *  em pé, no escuro, com o culto correndo. */
const ALVO = 'min-h-11';

type PropsBotao = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  className?: string;
};

/**
 * A ação principal de uma tela — laranja cheio, com sombra projetada.
 *
 * Existe no máximo uma por região visível: é o "Avançar bloco" do culto, o
 * "+ Nova ordem" do topo. Duas competindo tiram o sentido de haver uma.
 */
export function BotaoPrincipal({ children, className = '', ...resto }: PropsBotao) {
  return (
    <button
      type="button"
      {...resto}
      className={`${ALVO} cursor-pointer rounded-xl px-5 font-extrabold transition-colors disabled:cursor-default disabled:opacity-50 ${className}`}
      style={{
        background: 'var(--acento)',
        color: 'var(--acento-texto)',
        boxShadow: '0 14px 34px -16px var(--acento-sombra)',
        ...resto.style,
      }}
    >
      {children}
    </button>
  );
}

/** Ação de apoio — contorno, fundo elevado. "Modelos", "Editar roteiro". */
export function BotaoSecundario({ children, className = '', ...resto }: PropsBotao) {
  return (
    <button
      type="button"
      {...resto}
      className={`${ALVO} cursor-pointer rounded-xl border border-borda-forte bg-fundo-elevado px-4 font-semibold text-texto-suave transition-colors hover:bg-fundo-cartao hover:text-texto disabled:cursor-default disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

/** Ação discreta — sem fundo, só contorno fino. "Editar", "Duplicar". */
export function BotaoDiscreto({ children, className = '', ...resto }: PropsBotao) {
  return (
    <button
      type="button"
      {...resto}
      className={`${ALVO} cursor-pointer rounded-xl border border-borda bg-transparent px-4 text-sm text-texto-suave transition-colors hover:border-borda-forte hover:text-texto disabled:cursor-default disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Rótulo de seção em caixa alta, espaçado — "ACONTECENDO AGORA", "ROTEIRO",
 * "EM SEGUIDA", "PRÓXIMAS ORDENS".
 *
 * É o elemento que mais se repete na referência e o que mais dá a ela a cara
 * de painel de operação: cada bloco de informação é anunciado por uma linha
 * pequena e espaçada, em vez de por um título grande.
 */
export function Rotulo({
  children,
  className = '',
  tom = 'fraco',
}: {
  children: ReactNode;
  className?: string;
  /** `acento` para o rótulo do que está acontecendo agora. */
  tom?: 'fraco' | 'acento';
}) {
  return (
    <p
      className={`text-[11px] font-extrabold tracking-[0.18em] uppercase ${className}`}
      style={{
        color: tom === 'acento' ? 'var(--acento-texto-sobre-fundo)' : 'var(--texto-fraco)',
      }}
    >
      {children}
    </p>
  );
}

/**
 * Número em JetBrains Mono com largura de dígito fixa — horário, duração,
 * contador, cronômetro.
 *
 * Nunca para texto corrido: a fonte monoespaçada aqui é sinal de "isto é um
 * dado", e usá-la em frase apagaria essa distinção. Ver `globals.css`.
 */
export function Numero({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`numero ${className}`} style={style}>
      {children}
    </span>
  );
}

/** Cores possíveis de um selo. Cada uma é um par fundo/texto já conferido. */
export type TomDoSelo = 'neutro' | 'sucesso' | 'alerta' | 'acento' | 'urgente';

const TONS: Record<TomDoSelo, { background: string; color: string }> = {
  neutro: { background: 'var(--fundo-elevado)', color: 'var(--texto-suave)' },
  sucesso: { background: 'var(--sucesso-fundo)', color: 'var(--sucesso)' },
  alerta: { background: 'var(--alerta-fundo)', color: 'var(--alerta)' },
  acento: { background: 'var(--acento-suave-fundo)', color: 'var(--acento-texto-sobre-fundo)' },
  urgente: { background: 'var(--urgente-fundo)', color: 'var(--urgente)' },
};

/**
 * Pílula de estado — "Pronta", "Rascunho", "1 min atrasado", "Ativa agora".
 *
 * O tom é escolhido por quem chama porque a mesma forma carrega significados
 * diferentes conforme o contexto, e um mapa "texto → cor" aqui dentro só
 * adiaria a decisão para um lugar pior.
 */
export function Selo({
  children,
  tom = 'neutro',
  className = '',
}: {
  children: ReactNode;
  tom?: TomDoSelo;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${className}`}
      style={TONS[tom]}
    >
      {children}
    </span>
  );
}

/**
 * O ponto pulsante de "AO VIVO".
 *
 * `aria-hidden` porque é decoração: a palavra "AO VIVO" ao lado já diz o
 * mesmo para quem usa leitor de tela, e anunciar um ponto sem rótulo só
 * acrescentaria ruído. A animação respeita `prefers-reduced-motion` pela
 * regra global em `globals.css`.
 */
export function PontoAoVivo() {
  return (
    <span
      aria-hidden="true"
      className="pulso-ao-vivo inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: 'var(--acento)' }}
    />
  );
}

/** Cartão padrão: fundo de cartão, borda, canto arredondado. */
export function Cartao({
  children,
  className = '',
  destacado = false,
}: {
  children: ReactNode;
  className?: string;
  /** Borda de acento — para o cartão do culto que está no ar. */
  destacado?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border bg-fundo-cartao ${className}`}
      style={{ borderColor: destacado ? 'var(--acento-suave-borda)' : 'var(--borda)' }}
    >
      {children}
    </section>
  );
}

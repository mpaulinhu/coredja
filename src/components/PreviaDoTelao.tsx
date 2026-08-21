'use client';

import { Numero, Rotulo } from '@/components/Interface';

/**
 * O que a prévia precisa saber para desenhar o telão. Deliberadamente não é
 * `Aviso`: a prévia serve tanto a um aviso já salvo quanto ao que está sendo
 * digitado no formulário (que ainda não tem `id`, `criadoEm` nem `noAr`).
 */
export interface ConteudoDaPrevia {
  titulo: string;
  texto: string;
  /** URL da arte — `objectURL` no formulário, `imagem.url` na lista. */
  imagemUrl?: string;
  dias: string[];
  /** Etiqueta do canto superior direito ("NO TELÃO", "HOJE", "PROGRAMADO"). */
  etiqueta: string;
  /** Só `acento` para o que está no ar — o resto fica neutro. */
  etiquetaEmDestaque?: boolean;
}

/**
 * Como o aviso vai aparecer projetado — o "PRÉVIA DO TELÃO" da referência.
 *
 * Existe porque quem cadastra durante a semana não tem como ver o telão da
 * igreja: sem prévia, só se descobre que o título ficou grande demais ou que
 * a arte está cortada no domingo, na frente de todo mundo.
 *
 * A proporção é 16:9 fixa (`aspect-ratio`), a mesma do projetor, e as fontes
 * usam `clamp()` com unidade de container (`cqw`) em vez de `vw`: o cartão da
 * prévia não ocupa a largura da janela, então `vw` faria o texto crescer
 * junto com a tela inteira em vez de junto com o quadro. É a diferença entre
 * a prévia ser fiel e ser só decorativa.
 *
 * Quando há arte, ela é o conteúdo — texto vai por cima só como legenda, com
 * um véu escuro atrás para o contraste não depender da imagem que o usuário
 * escolheu (uma arte clara apagaria texto branco).
 */
export function PreviaDoTelao({ conteudo }: { conteudo: ConteudoDaPrevia }) {
  const { titulo, texto, imagemUrl, dias, etiqueta, etiquetaEmDestaque } = conteudo;

  const temTexto = Boolean(titulo.trim() || texto.trim());
  const corEtiqueta = etiquetaEmDestaque
    ? 'var(--acento-texto-sobre-fundo)'
    : 'var(--texto-fraco)';

  return (
    <div
      // `@container` liga a unidade `cqw` usada no `clamp()` abaixo.
      className="@container relative flex aspect-video flex-col justify-center gap-[3%] overflow-hidden rounded-2xl border px-[9%] py-[8%]"
      style={{
        borderColor: 'var(--borda)',
        // O quadro é sempre escuro, nos DOIS temas: é a cor do projetor
        // desligado, não uma superfície da interface. No tema claro um
        // retângulo branco dentro de um cartão branco não leria como "tela".
        background: '#0a0807',
      }}
    >
      {imagemUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagemUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Véu só quando há texto por cima: numa arte sozinha ele só
              escureceria o que a pessoa quer conferir. */}
          {temTexto && (
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: 'rgb(10 8 7 / 0.62)' }}
            />
          )}
        </>
      )}

      <div
        className="absolute top-[4%] right-[5%] flex items-center gap-2 text-[clamp(9px,1.6cqw,13px)] font-extrabold tracking-[0.14em] uppercase"
        style={{ color: corEtiqueta }}
      >
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: corEtiqueta }}
        />
        {etiqueta}
      </div>

      {/* `relative` para ficar acima do véu e da arte. */}
      <div className="relative flex flex-col gap-[3%]">
        {titulo.trim() ? (
          <p
            className="text-[clamp(18px,5.6cqw,54px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance"
            style={{ color: '#fff5ee' }}
          >
            {titulo}
          </p>
        ) : (
          !imagemUrl && (
            <p
              className="text-[clamp(14px,3.2cqw,28px)] leading-tight font-semibold"
              style={{ color: '#7d6f66' }}
            >
              O título aparece aqui, grande, no telão.
            </p>
          )
        )}

        {texto.trim() && (
          <p
            className="max-w-[80%] text-[clamp(11px,2.4cqw,22px)] leading-[1.4] text-pretty"
            style={{ color: '#c9b8ae' }}
          >
            {texto}
          </p>
        )}

        {dias.length > 0 && (
          <Numero
            className="text-[clamp(9px,1.8cqw,16px)] tracking-[0.06em]"
            style={{ color: '#8fb0e0' }}
          >
            {dias.map(formatarDiaCurto).join('  ·  ')}
          </Numero>
        )}
      </div>
    </div>
  );
}

/** `"2026-08-23"` vira `"23/08"` — o ano polui e raramente importa. */
function formatarDiaCurto(dia: string): string {
  const [, mes, d] = dia.split('-');
  return `${d}/${mes}`;
}

/** Cabeçalho da seção da prévia, com a resolução recomendada à direita. */
export function CabecalhoDaPrevia() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-borda px-5 py-4 sm:px-6">
      <Rotulo>Prévia do telão</Rotulo>
      <Numero className="text-xs text-texto-fraco">1920 × 1080</Numero>
    </div>
  );
}

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
  /** Nome original do arquivo, para o botão de baixar sugerir esse nome em vez de um data URI. */
  imagemNome?: string;
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
  const { titulo, texto, imagemUrl, imagemNome, etiqueta, etiquetaEmDestaque } = conteudo;

  const temTexto = Boolean(titulo.trim() || texto.trim());
  const corEtiqueta = etiquetaEmDestaque
    ? 'var(--acento-texto-sobre-fundo)'
    : 'var(--texto-fraco)';

  return (
    <div
      // `@container` liga a unidade `cqw` usada no `clamp()` abaixo.
      // Centralizado nos dois eixos, como o Painel de Comunicação do
      // Holyrics de fato projeta — confirmado contra uma captura real
      // (21/08/2026): título e subtítulo saem no meio da tela, não
      // alinhados à esquerda.
      className="@container relative flex aspect-video flex-col items-center justify-center gap-[3%] overflow-hidden rounded-2xl border px-[9%] py-[8%] text-center"
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
          {/* `download` funciona com `objectURL` (formulário) e com data URI
              (aviso já salvo) igual — os dois são reconhecidos pelo navegador
              como origem local, sem passar por um servidor de novo. */}
          <a
            href={imagemUrl}
            download={imagemNome || 'arte-do-aviso'}
            aria-label="Baixar esta imagem"
            title="Baixar imagem"
            className="absolute right-[3%] bottom-[3%] flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/25"
            style={{ background: 'rgb(0 0 0 / 0.45)' }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="#fff5ee"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v12" />
              <path d="M7 10l5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </a>
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

      {/* `relative` para ficar acima do véu e da arte. Uma cor só de letra,
          um tamanho só de fonte para título e detalhes: é fiel ao que o
          Holyrics realmente projeta — a API dele só recebe texto puro (sem
          cor nem tamanho por linha), e o template configurado lá desenha o
          bloco inteiro com a mesma fonte, do mesmo tamanho. Confirmado
          contra uma captura real do Holyrics (21/08/2026). A quebra de
          linha entre título e detalhes é o único jeito real de separar os
          dois, e é a mesma folga generosa vista na captura. */}
      <div className="relative flex flex-col items-center gap-[6%]">
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
            className="max-w-[85%] text-[clamp(18px,5.6cqw,54px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-pretty"
            style={{ color: '#fff5ee' }}
          >
            {texto}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Em quais dias o aviso vale — metadado do Coredja, não texto projetado.
 *
 * Vive FORA do quadro preto de `PreviaDoTelao` de propósito: título e
 * detalhes são o que a API manda ao Holyrics, mas os dias nunca são
 * enviados — são só a regra de quando o Coredja oferece o botão de
 * publicar. Misturar os dois dentro do quadro sugeriria que a data também
 * aparece no telão, o que não é verdade.
 */
export function DiasDaPrevia({ dias }: { dias: string[] }) {
  if (dias.length === 0) return null;
  return (
    <Numero className="mt-2 block text-xs text-texto-fraco">
      Vale em: {dias.map(formatarDiaCurto).join('  ·  ')}
    </Numero>
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

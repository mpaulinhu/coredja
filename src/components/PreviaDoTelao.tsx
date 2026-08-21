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
 * `modo` existe porque texto e arte são DUAS TELAS diferentes no Holyrics,
 * nunca uma sobre a outra:
 *
 * - `'texto'`  → o Painel de Comunicação, que só recebe texto puro.
 * - `'imagem'` → a Foto exibida pela aba Fotos, sem texto por cima.
 *
 * Antes as duas eram desenhadas juntas (texto sobre a arte, com um véu
 * escuro atrás), o que prometia um resultado que o telão nunca entrega. Ver
 * `PreviasDoAviso`, que mostra as duas lado a lado quando há arte.
 */
export function PreviaDoTelao({
  conteudo,
  modo = 'texto',
}: {
  conteudo: ConteudoDaPrevia;
  modo?: 'texto' | 'imagem';
}) {
  const { titulo, texto, imagemUrl, imagemNome, etiqueta, etiquetaEmDestaque } = conteudo;

  const mostrarImagem = modo === 'imagem' && Boolean(imagemUrl);
  const mostrarTexto = modo === 'texto';
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
      {mostrarImagem && (
        <>
          {/* `contain`, e não `cover`: a arte aparece INTEIRA, como o Holyrics
              exibe uma foto. `cover` cortaria as bordas e esconderia
              justamente o que a prévia existe para conferir. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagemUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-contain"
          />
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

      {/* Só na prévia de TEXTO: a etiqueta fala do estado do texto ("No
          retorno", "Hoje", "Programado"), que não diz nada sobre a arte —
          repeti-la sobre a imagem sugeriria que a foto também está no ar. */}
      {mostrarTexto && (
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
      )}

      {/* Uma cor só de letra, um tamanho só de fonte para título e detalhes:
          é fiel ao que o Holyrics realmente projeta — a API dele só recebe
          texto puro (sem cor nem tamanho por linha), e o template configurado
          lá desenha o bloco inteiro com a mesma fonte, do mesmo tamanho.
          Confirmado contra uma captura real do Holyrics (21/08/2026). A
          quebra de linha entre título e detalhes é o único jeito real de
          separar os dois, e é a mesma folga generosa vista na captura. */}
      {mostrarTexto && (
        <div className="relative flex flex-col items-center gap-[6%]">
          {titulo.trim() ? (
            <p
              className="text-[clamp(18px,5.6cqw,54px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance"
              style={{ color: '#fff5ee' }}
            >
              {titulo}
            </p>
          ) : (
            !texto.trim() && (
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
      )}
    </div>
  );
}

/**
 * As prévias do aviso: a tela de texto e, quando há arte, a da imagem.
 *
 * Lado a lado (empilhadas no celular) porque são duas telas DIFERENTES do
 * Holyrics, exibidas em momentos diferentes — não uma composição. Cada uma
 * ganha um rótulo dizendo de onde vem, senão duas caixas pretas parecidas
 * viram adivinhação.
 *
 * Sem arte, só a de texto aparece: um quadro vazio rotulado "a arte" não
 * informa nada que a ausência já não diga.
 */
export function PreviasDoAviso({ conteudo }: { conteudo: ConteudoDaPrevia }) {
  if (!conteudo.imagemUrl) {
    return <PreviaDoTelao conteudo={conteudo} modo="texto" />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0">
        <PreviaDoTelao conteudo={conteudo} modo="texto" />
        <p className="mt-2 text-xs text-texto-fraco">
          <span className="font-semibold text-texto-suave">Tela de retorno</span> — o
          texto, no painel de comunicação.
        </p>
      </div>
      <div className="min-w-0">
        <PreviaDoTelao conteudo={conteudo} modo="imagem" />
        <p className="mt-2 text-xs text-texto-fraco">
          <span className="font-semibold text-texto-suave">Arte</span> — vai para as
          Fotos do Holyrics, exibida à parte.
        </p>
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

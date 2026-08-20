'use client';

import { useEffect, useRef, useState } from 'react';
import { Recado } from '@/components/Recado';
import {
  BotaoDiscreto,
  BotaoPrincipal,
  BotaoSecundario,
  Cartao,
  Numero,
  PontoAoVivo,
  Rotulo,
  Selo,
  type TomDoSelo,
} from '@/components/Interface';
import {
  atrasoEmMinutos,
  formatarCronometro,
  horariosDosBlocos,
  indiceDoBlocoAtual,
  lerTempoDigitado,
  minutosDoBloco,
  percentualDoBloco,
  percentualDoCulto,
  responsavelDoBloco,
  restanteDoBloco,
  terminoPrevisto,
  totalDeMinutos,
  type Culto,
} from '@/lib/culto';
import { useRelogio } from '@/lib/usar-relogio';

interface Props {
  culto: Culto | null;
  /** Devolve um recado a mostrar (ex: cronômetro não foi ao Holyrics), ou null. */
  onAvancar: () => Promise<string | null>;
  /** Põe o culto direto num bloco. Mesmo contrato de `onAvancar`. */
  onIrParaBloco: (blocoId: string) => Promise<string | null>;
  /**
   * Estica o cronômetro do bloco em andamento — `minutos` negativo encurta.
   * Mesmo contrato de `onAvancar`.
   */
  onTempoExtra: (minutos: number) => Promise<string | null>;
  /**
   * Acerta quanto AINDA FALTA do bloco, em segundos — o tempo digitado no
   * cronômetro. Mesmo contrato de `onAvancar`.
   *
   * Opcional porque nem toda montagem desta tela precisa oferecer o ajuste
   * fino; sem ela o cronômetro volta a ser só um número, sem virar botão.
   */
  onDefinirRestante?: (segundos: number) => Promise<string | null>;
  /** Pausa/retoma o cronômetro. Mesmo contrato de `onAvancar`. */
  onPausar: (pausar: boolean) => Promise<string | null>;
  /** Marca a ordem como concluída — o "Concluir culto" do pé do roteiro. */
  onConcluir?: () => Promise<void>;
  /** Abre esta ordem no editor — "Editar roteiro" / "+ Adicionar bloco". */
  onEditar?: () => void;
  /**
   * Sair da operação. Ausente para quem não pode montar: esse perfil não tem
   * uma lista de ordens atrás desta tela para onde voltar.
   */
  onVoltar?: () => void;
}

/** "domingo, 24 de agosto" — o dia da semana importa mais que o ano aqui. */
function dataPorExtenso(data: string): string {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

/**
 * O painel de operar o culto ao vivo — a tela do domingo.
 *
 * Refeito em 20/08/2026 a partir de uma tela de referência que o Marcos
 * entregou pronta ("faça a tela exatamente assim"). O que mudou em relação à
 * versão anterior, e por quê:
 *
 * - **Duas colunas em vez de uma.** À esquerda o que está acontecendo AGORA
 *   (bloco, cronômetro, progresso, o que vem em seguida, avançar); à direita
 *   o roteiro inteiro com horário calculado de cada bloco. Antes, a sequência
 *   ficava embaixo do painel e exigia rolar para conferir "estamos no
 *   horário?" — que é a pergunta que mais se faz durante o culto.
 * - **Cronômetro na própria tela**, não só no Holyrics. Quem opera passou a
 *   ver o mesmo número que está no telão, sem virar a cabeça. Ele é DERIVADO
 *   (ver `useRelogio` e `culto.ts`), não acumulado em memória: recarregar a
 *   página no meio da pregação não reinicia a contagem.
 * - **"X min atrasado"**, comparando o horário previsto do bloco atual com o
 *   relógio real. É a informação que fazia alguém ficar somando de cabeça.
 * - **Pausar**, que o telão sozinho não tinha.
 *
 * A tela deixou de ser `fixed inset-0`: com a casca do app em volta, a barra
 * lateral mostra a "Equipe de hoje" (ver `MenuLateral`), que é informação
 * útil no domingo. A hierarquia continua sendo lida de longe — o nome do
 * bloco e o cronômetro são os dois maiores elementos da página.
 */
export function ExecucaoCulto({
  culto,
  onAvancar,
  onIrParaBloco,
  onTempoExtra,
  onDefinirRestante,
  onPausar,
  onConcluir,
  onEditar,
  onVoltar,
}: Props) {
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  /** Cronômetro em modo de digitação. Ver `CronometroEditavel`. */
  const [editandoTempo, setEditandoTempo] = useState(false);

  const indiceAtual = culto ? indiceDoBlocoAtual(culto) : -1;
  const comecou = culto != null && indiceAtual !== -1;
  const pausado = Boolean(culto?.pausadoEm);

  // O relógio só corre quando há o que contar: sem bloco em andamento, ou
  // com o culto pausado, nada na tela muda de segundo em segundo.
  //
  // Editando o tempo ele também para: o tique não chegaria a apagar o que
  // está sendo digitado (o `<input>` é controlado pelo rascunho do próprio
  // `CronometroEditavel`), mas re-renderizar a tela inteira uma vez por
  // segundo durante a digitação é trabalho à toa — e mexe na barra de
  // progresso e no "% concluído" logo abaixo do campo, o que distrai quem
  // está tentando ler o que digitou.
  const agora = useRelogio(comecou && !pausado && !editandoTempo);

  // Esc sai da operação — atalho esperado de qualquer painel em tela cheia, e
  // uma saída a mais num momento em que ninguém quer procurar botão.
  //
  // Editando o tempo, Esc pertence ao campo (cancela a digitação) e não pode
  // fechar a tela junto: quem apertou queria desfazer o que digitou, não
  // abandonar a operação do culto.
  useEffect(() => {
    if (!onVoltar || editandoTempo) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onVoltar?.();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onVoltar, editandoTempo]);

  async function executar(acao: () => Promise<string | null>) {
    // Trava durante a ida ao servidor: dois "+5" seguidos somariam 10, e dois
    // "Avançar" pulariam um bloco.
    setOcupado(true);
    setRecado(null);
    try {
      setRecado(await acao());
    } finally {
      setOcupado(false);
    }
  }

  if (!culto) {
    return (
      <div className="flex min-h-full items-center justify-center px-5 py-16 text-center">
        <div>
          <Rotulo>Nada no ar</Rotulo>
          <p className="mx-auto mt-3 max-w-md text-sm text-texto-suave">
            Nenhuma ordem ativa agora. Se já houve um culto hoje, ele pode ter
            sido marcado como concluído — ou a próxima ordem ainda está como
            rascunho.
          </p>
          {onVoltar && (
            <BotaoSecundario onClick={onVoltar} className="mt-5 text-sm">
              ← Todas as ordens
            </BotaoSecundario>
          )}
        </div>
      </div>
    );
  }

  const blocos = culto.blocos;
  const horarios = horariosDosBlocos(culto);
  const total = totalDeMinutos(blocos);
  const encerrado = culto.blocoAtualId !== null && indiceAtual === -1;
  const noUltimo = indiceAtual === blocos.length - 1;

  const blocoAtual = comecou ? blocos[indiceAtual] : null;
  const proximo = comecou ? blocos[indiceAtual + 1] : blocos[0];
  const indiceProximo = comecou ? indiceAtual + 1 : 0;

  const restante = restanteDoBloco(culto, agora);
  const estourou = comecou && restante < 0;
  // Um minuto de aviso antes de estourar: dá tempo de emendar sem que a
  // primeira notícia do fim do bloco seja o número já negativo.
  const quaseNoFim = comecou && !estourou && restante <= 60;
  const corDoCronometro = estourou
    ? 'var(--urgente)'
    : quaseNoFim
      ? 'var(--alerta)'
      : 'var(--acento-texto-sobre-fundo)';

  const atraso = atrasoEmMinutos(culto, agora);
  const selo = seloDeAtraso(atraso, pausado);

  const extras = Number(culto.minutosExtras) || 0;
  const duracaoAtual = blocoAtual ? minutosDoBloco(blocoAtual) + extras : 0;

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-10">
      {/* ── Cabeçalho da página ─────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          {onVoltar && (
            <button
              type="button"
              onClick={onVoltar}
              className="mb-3 cursor-pointer text-sm text-texto-suave hover:text-texto"
            >
              ← Todas as ordens
            </button>
          )}
          <Rotulo className="first-letter:uppercase">{dataPorExtenso(culto.data)}</Rotulo>
          <h1 className="mt-2 text-3xl leading-[1.05] font-extrabold tracking-[-0.03em] text-texto sm:text-[40px]">
            Ordem do Culto
          </h1>
          <p className="mt-2 max-w-xl text-sm text-texto-suave">
            Quem está no controle vê a ordem certa se atualizar sozinha — sem
            precisar recarregar a página.
          </p>
        </div>

        {onEditar && (
          <BotaoSecundario onClick={onEditar} className="text-sm">
            Editar roteiro
          </BotaoSecundario>
        )}
      </header>

      {/* ── O cartão do culto ao vivo ───────────────────────────────────── */}
      <Cartao destacado className="mt-7 overflow-hidden">
        {/* Faixa de identificação: o que está no ar, e os controles que
            valem para o culto inteiro (atraso, pausar, editar). */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borda bg-fundo-elevado px-5 py-4 sm:px-7">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {comecou && !encerrado && <PontoAoVivo />}
            <span
              className="text-[11px] font-extrabold tracking-[0.18em] uppercase"
              style={{ color: 'var(--acento-texto-sobre-fundo)' }}
            >
              {encerrado ? 'Encerrado' : comecou ? 'Ao vivo' : 'Aguardando'}
            </span>
            <span aria-hidden="true" className="hidden h-4 w-px bg-borda-forte sm:block" />
            <span className="truncate text-base font-bold text-texto">
              {dataPorExtenso(culto.data).split(',')[0]}
            </span>
            <Numero className="text-sm text-texto-suave">
              {culto.hora} · {blocos.length} {blocos.length === 1 ? 'bloco' : 'blocos'} ·{' '}
              {total} min
            </Numero>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {selo && <Selo tom={selo.tom}>{selo.texto}</Selo>}
            {comecou && !encerrado && (
              <BotaoDiscreto
                onClick={() => executar(() => onPausar(!pausado))}
                disabled={ocupado}
                className="text-sm"
              >
                {pausado ? 'Retomar' : 'Pausar'}
              </BotaoDiscreto>
            )}
          </div>
        </div>

        {/* Duas colunas de largura igual acima de `lg`; empilhadas abaixo,
            com o painel do "agora" primeiro — no celular, quem opera precisa
            do cronômetro sem rolar. */}
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* ── Coluna 1: o que está acontecendo agora ─────────────────── */}
          <div className="flex flex-col gap-6 border-b border-borda p-5 sm:p-7 lg:border-r lg:border-b-0">
            <div>
              <Rotulo tom="acento">
                {encerrado
                  ? 'Culto encerrado'
                  : comecou
                    ? 'Acontecendo agora'
                    : 'Ainda não começou'}
              </Rotulo>

              <p className="mt-3 text-3xl leading-[1.08] font-extrabold tracking-[-0.03em] break-words text-texto sm:text-[44px]">
                {encerrado
                  ? 'Fim da sequência'
                  : (blocoAtual ?? blocos[0])?.titulo || 'Sem título'}
              </p>

              {!encerrado && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm text-texto-suave">
                  {responsavelDoBloco((blocoAtual ?? blocos[0]) ?? { responsavel: '' }) && (
                    <>
                      <span>
                        {responsavelDoBloco(
                          (blocoAtual ?? blocos[0]) ?? { responsavel: '' },
                        )}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-1 w-1 rounded-full bg-borda-forte"
                      />
                    </>
                  )}
                  <Numero>
                    {horarios[comecou ? indiceAtual : 0]} ·{' '}
                    {comecou ? duracaoAtual : minutosDoBloco(blocos[0] ?? { minutos: 0 })}{' '}
                    min previstos
                  </Numero>
                </div>
              )}
            </div>

            {/* Cronômetro — o maior número da tela, para ser lido de longe.
                `aria-live` para quem usa leitor de tela ouvir a troca de
                bloco; o número em si não é anunciado a cada segundo porque
                está fora da região (só o rótulo muda de estado). */}
            {comecou && !encerrado && (
              <div>
                <div className="flex flex-wrap items-baseline gap-4">
                  <CronometroEditavel
                    restante={restante}
                    cor={corDoCronometro}
                    editando={editandoTempo}
                    onAbrir={() => setEditandoTempo(true)}
                    onFechar={() => setEditandoTempo(false)}
                    onConfirmar={
                      onDefinirRestante
                        ? (segundos) => executar(() => onDefinirRestante(segundos))
                        : undefined
                    }
                    desabilitado={ocupado}
                  />
                  <p
                    className="pb-2 text-xs font-bold tracking-[0.1em] uppercase"
                    style={{ color: 'var(--texto-fraco)' }}
                  >
                    {editandoTempo
                      ? 'Enter confirma · Esc cancela'
                      : pausado
                        ? 'Pausado'
                        : estourou
                          ? 'Além do previsto'
                          : 'Restantes neste bloco'}
                  </p>
                </div>

                <div
                  className="mt-5 h-2.5 overflow-hidden rounded-full"
                  style={{ background: 'var(--fundo-elevado)' }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(percentualDoCulto(culto, agora))}
                  aria-label="Progresso do culto"
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                    style={{
                      width: `${percentualDoBloco(culto, agora).toFixed(1)}%`,
                      background: corDoCronometro,
                    }}
                  />
                </div>

                <div className="mt-2.5 flex justify-between text-xs text-texto-fraco">
                  <Numero>
                    bloco {indiceAtual + 1} de {blocos.length}
                  </Numero>
                  <Numero>culto {percentualDoCulto(culto, agora)}% concluído</Numero>
                </div>
              </div>
            )}

            {/* EM SEGUIDA — o próximo bloco em destaque, para quem vai
                assumir se preparar sem ler o roteiro inteiro. */}
            {!encerrado && (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-borda bg-fundo-elevado px-4 py-3.5">
                <div className="min-w-0">
                  <Rotulo>Em seguida</Rotulo>
                  <p className="mt-1.5 truncate text-base font-bold text-texto">
                    {proximo ? proximo.titulo || 'Sem título' : 'Fim do culto'}
                  </p>
                </div>
                <Numero className="shrink-0 text-sm whitespace-nowrap text-texto-suave">
                  {proximo
                    ? `${horarios[indiceProximo]} · ${minutosDoBloco(proximo)} min`
                    : '—'}
                </Numero>
              </div>
            )}

            {recado && <Recado texto={recado} onDispensar={() => setRecado(null)} />}

            {/* Avançar é o segundo elemento mais forte da tela, depois do
                cronômetro. Os ajustes de tempo ficam numa LINHA PRÓPRIA
                abaixo, discretos e monoespaçados: são quatro agora (−5 −1
                +1 +5), e enfileirá-los ao lado do "Avançar" espremeria os
                dois — no celular, quatro alvos de 44px mais o botão
                principal não cabem na mesma faixa sem quebrar feio.

                A ordem é a da reta numérica (tirar à esquerda, somar à
                direita), com o par de 1 min no meio: os ajustes finos ficam
                vizinhos, e os "grandes" nas pontas, longe um do outro. */}
            <div className="mt-auto flex flex-col gap-3">
              <BotaoPrincipal
                onClick={() => executar(onAvancar)}
                disabled={ocupado || encerrado || blocos.length === 0}
                className="h-16 w-full text-lg sm:h-[68px]"
              >
                {encerrado
                  ? 'Culto encerrado'
                  : !comecou
                    ? 'Começar culto'
                    : noUltimo
                      ? 'Encerrar culto'
                      : 'Avançar bloco →'}
              </BotaoPrincipal>

              <div className="flex gap-2">
                {[-5, -1, 1, 5].map((minutos) => (
                  <BotaoDiscreto
                    key={minutos}
                    onClick={() => executar(() => onTempoExtra(minutos))}
                    disabled={ocupado || !comecou || encerrado}
                    aria-label={
                      minutos > 0
                        ? `Dar mais ${minutos} minuto${minutos > 1 ? 's' : ''} ao bloco em andamento`
                        : `Tirar ${-minutos} minuto${minutos < -1 ? 's' : ''} do bloco em andamento`
                    }
                    className="numero h-12 flex-1 px-0 font-bold"
                  >
                    {/* Sinal literal `−` (U+2212), não hífen: no traço do
                        hífen o "-5" fica quase indistinguível do "+5" de
                        relance, que é como esta tela é lida. */}
                    {minutos > 0 ? '+' : '−'}
                    {Math.abs(minutos)}
                  </BotaoDiscreto>
                ))}
              </div>
            </div>
          </div>

          {/* ── Coluna 2: o roteiro inteiro ────────────────────────────── */}
          <div
            className="flex flex-col gap-3.5 p-5 sm:p-7"
            style={{ background: 'var(--fundo)' }}
          >
            <div className="flex items-center justify-between gap-3">
              <Rotulo>Roteiro</Rotulo>
              <Numero className="text-xs text-texto-fraco">
                término previsto {terminoPrevisto(culto)}
              </Numero>
            </div>

            <ol className="flex flex-col gap-2">
              {blocos.map((bloco, i) => {
                const passou = comecou && i < indiceAtual;
                const eAgora = i === indiceAtual;
                const responsavel = responsavelDoBloco(bloco);

                return (
                  <li key={bloco.id}>
                    {/* Toda a linha é clicável: dá para pular adiante (o
                        louvor emendou na palavra) e, principalmente, VOLTAR
                        quando alguém avança sem querer. */}
                    <button
                      type="button"
                      onClick={() => executar(() => onIrParaBloco(bloco.id))}
                      disabled={ocupado}
                      aria-current={eAgora ? 'step' : undefined}
                      className="grid min-h-14 w-full cursor-pointer grid-cols-[26px_1fr_auto] items-center gap-3.5 rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-borda-forte disabled:cursor-default disabled:opacity-60"
                      style={{
                        background: eAgora
                          ? 'var(--acento-suave-fundo)'
                          : 'var(--fundo-cartao)',
                        borderColor: eAgora ? 'var(--acento-suave-borda)' : 'var(--borda)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="numero flex h-6.5 w-6.5 items-center justify-center rounded-lg text-xs font-extrabold"
                        style={{
                          background: eAgora
                            ? 'var(--acento)'
                            : passou
                              ? 'var(--sucesso-fundo)'
                              : 'var(--fundo-elevado)',
                          color: eAgora
                            ? 'var(--acento-texto)'
                            : passou
                              ? 'var(--sucesso)'
                              : 'var(--texto-fraco)',
                        }}
                      >
                        {passou ? '✓' : eAgora ? '▶' : i + 1}
                      </span>

                      <span className="min-w-0">
                        <span
                          className={`block truncate ${eAgora ? 'font-extrabold' : 'font-semibold'}`}
                          style={{
                            color: passou ? 'var(--texto-fraco)' : 'var(--texto)',
                          }}
                        >
                          {bloco.titulo || 'Sem título'}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-texto-fraco">
                          {responsavel ??
                            (passou ? 'concluído' : eAgora ? 'em andamento' : 'aguardando')}
                        </span>
                      </span>

                      <span className="numero shrink-0 text-right">
                        <span
                          className="block text-sm"
                          style={{
                            color: passou ? 'var(--texto-fraco)' : 'var(--texto)',
                          }}
                        >
                          {minutosDoBloco(bloco)} min
                        </span>
                        <span className="mt-0.5 block text-xs text-texto-fraco">
                          {horarios[i]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-auto flex flex-wrap gap-2.5 pt-1.5">
              {onEditar && (
                <button
                  type="button"
                  onClick={onEditar}
                  className="min-h-11 flex-1 cursor-pointer rounded-xl border border-dashed border-borda-forte px-4 text-sm font-semibold text-texto-suave transition-colors hover:text-texto"
                  style={{ background: 'transparent' }}
                >
                  + Adicionar bloco
                </button>
              )}
              {onConcluir && (
                <BotaoSecundario
                  onClick={() => void onConcluir()}
                  disabled={ocupado}
                  className="text-sm"
                >
                  Concluir culto
                </BotaoSecundario>
              )}
            </div>
          </div>
        </div>
      </Cartao>
    </div>
  );
}

/**
 * O número grande do cronômetro, que vira campo de digitação ao ser clicado.
 *
 * O gesto pedido foi "clicar na caixa e escrever o tempo". O que se digita é
 * o que AINDA FALTA agora (está em 09:49, digita 5, passa a contar 5
 * minutos) — e não a duração do bloco: quem olha o cronômetro no domingo está
 * pensando "faltam quantos", não "o bloco tem quantos". A duração continua
 * sendo o que o roteiro diz, e é o `+1/+5` que mexe nela.
 *
 * É um `<button>` que TROCA por um `<input>`, não um `<div onClick>`: o
 * cronômetro virou controle interativo, e precisa entrar na ordem de
 * tabulação, responder a Enter/Espaço e se anunciar como algo acionável.
 *
 * Sobre o lint (`react-hooks/set-state-in-effect`): não há efeito nenhum
 * sincronizando o rascunho com o `restante`. O rascunho nasce no gesto de
 * abrir (`onClick`), fora do render, e daí em diante o campo é dono do que
 * mostra — é justamente isso que impede o tique do relógio de sobrescrever a
 * digitação. O único efeito aqui é o foco, que não muda estado do React.
 */
function CronometroEditavel({
  restante,
  cor,
  editando,
  onAbrir,
  onFechar,
  onConfirmar,
  desabilitado,
}: {
  /** Segundos que faltam. Negativo = o bloco estourou o tempo. */
  restante: number;
  cor: string;
  editando: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  /** Ausente = cronômetro só de leitura, sem virar botão. */
  onConfirmar?: (segundos: number) => void;
  desabilitado: boolean;
}) {
  const [rascunho, setRascunho] = useState('');
  const campo = useRef<HTMLInputElement>(null);

  const CLASSES_NUMERO =
    'text-6xl leading-[0.9] font-bold tracking-[-0.04em] sm:text-[88px]';

  useEffect(() => {
    if (!editando) return;
    // Seleciona tudo ao abrir: o gesto seguinte quase sempre é digitar um
    // tempo NOVO, não emendar no que já estava — obrigar a apagar antes
    // seria um passo a mais com o culto correndo.
    campo.current?.select();
  }, [editando]);

  function fechar() {
    setRascunho('');
    onFechar();
  }

  /** Enter e o clique fora passam por aqui. Entrada ilegível não fecha nada. */
  function confirmar() {
    const segundos = lerTempoDigitado(rascunho);
    // Campo vazio (`null` de "não deu para ler o vazio") é desistência —
    // apagar tudo e sair não deveria zerar o cronômetro do culto.
    if (segundos === null) {
      fechar();
      return;
    }
    onConfirmar?.(segundos);
    fechar();
  }

  if (!onConfirmar) {
    return (
      <Numero className={CLASSES_NUMERO} style={{ color: cor }}>
        {restante < 0 ? '+' : ''}
        {formatarCronometro(restante)}
      </Numero>
    );
  }

  if (editando) {
    return (
      <input
        ref={campo}
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        // `inputMode="numeric"` e não `type="number"`: o campo aceita
        // "5:30", que um input numérico recusaria — e o teclado do celular
        // precisa abrir nos números do mesmo jeito.
        inputMode="numeric"
        autoComplete="off"
        aria-label="Tempo restante neste bloco, em minutos ou MM:SS"
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirmar();
          // `stopPropagation` porque a tela inteira escuta Esc para sair da
          // operação; sem isso, cancelar a digitação fecharia o painel junto.
          if (e.key === 'Escape') {
            e.stopPropagation();
            fechar();
          }
        }}
        // Clicar fora CONFIRMA, e não cancela: a pessoa digitou um número
        // com intenção, e descartá-lo por tocar em outro lugar da tela
        // (fácil de fazer sem querer no celular, no escuro) obrigaria a
        // digitar de novo. O caminho de desfazer existe e é explícito —
        // Esc — e um valor confirmado por engano se corrige digitando outro.
        onBlur={confirmar}
        className={`numero w-[4.5ch] min-w-0 rounded-xl border bg-transparent px-2 text-left tabular-nums focus:outline-none ${CLASSES_NUMERO}`}
        style={{
          color: cor,
          borderColor: 'var(--acento-suave-borda)',
          background: 'var(--acento-suave-fundo)',
        }}
        placeholder={formatarCronometro(restante)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        // O rascunho começa VAZIO, não preenchido com o tempo atual: o
        // número corrente já aparece de placeholder, e um campo vazio deixa
        // digitar "5" direto, sem apagar nada antes.
        setRascunho('');
        onAbrir();
      }}
      disabled={desabilitado}
      aria-label={`Ajustar tempo restante. Faltam ${formatarCronometro(restante)}`}
      className={`numero -mx-2 cursor-pointer rounded-xl border border-transparent bg-transparent px-2 text-left transition-colors hover:border-borda-forte disabled:cursor-default disabled:opacity-50 ${CLASSES_NUMERO}`}
      style={{ color: cor }}
    >
      {restante < 0 ? '+' : ''}
      {formatarCronometro(restante)}
    </button>
  );
}

/**
 * O selo de "1 min atrasado" / "2 min adiantado" / "No horário".
 *
 * A margem de 1 minuto para cada lado existe porque o horário previsto tem
 * granularidade de minuto: sem ela o selo ficaria alternando entre "no
 * horário" e "1 min atrasado" a cada virada de minuto, o que é ruído.
 *
 * Pausado, não mostra nada: com o relógio parado o atraso continuaria
 * crescendo em relação ao horário previsto, e exibir isso como se fosse
 * medida do culto seria mentir sobre algo que ninguém está mais correndo.
 */
function seloDeAtraso(
  atraso: number | null,
  pausado: boolean,
): { texto: string; tom: TomDoSelo } | null {
  if (pausado) return { texto: 'Pausado', tom: 'alerta' };
  if (atraso === null) return null;

  if (atraso >= 1) return { texto: `${atraso} min atrasado`, tom: 'urgente' };
  if (atraso <= -1) return { texto: `${-atraso} min adiantado`, tom: 'sucesso' };
  return { texto: 'No horário', tom: 'sucesso' };
}


'use client';

import { useState } from 'react';
import {
  BotaoDiscreto,
  BotaoPrincipal,
  BotaoSecundario,
  Cartao,
  Numero,
  Rotulo,
  Selo,
} from '@/components/Interface';
import {
  hojeLocal,
  minutosDoBloco,
  statusDoCulto,
  totalDeMinutos,
  type Culto,
} from '@/lib/culto';

interface Props {
  cultos: Culto[];
  ativaId: string | null;
  onNova: () => void;
  onEditar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onRemover: (id: string) => Promise<void>;
  /** Abre a tela de operar o culto ao vivo. */
  onOperar: (id: string) => void;
  onConcluir: (id: string, concluir: boolean) => Promise<void>;
  /** Promove um rascunho a "pronta" — o "Concluir rascunho" da referência. */
  onMarcarPronta: (id: string) => Promise<void>;
  /** Abre a biblioteca de modelos — o botão "Modelos" do topo. */
  onModelos: () => void;
}

/** "domingo, 24 de agosto" — o dia da semana importa mais que o ano aqui. */
function dataPorExtenso(data: string): string {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

/** "Hoje · 18:00 · 4 blocos · 40 min" — a linha de dados do cartão. */
function resumo(culto: Culto, hoje: string): string {
  const quando = culto.data === hoje ? 'Hoje' : dataPorExtenso(culto.data);
  const blocos = culto.blocos.length === 1 ? '1 bloco' : `${culto.blocos.length} blocos`;
  return `${quando} · ${culto.hora} · ${blocos} · ${totalDeMinutos(culto.blocos)} min`;
}

/**
 * "3 de 5 blocos" quando o culto está em andamento — sinal de progresso, não
 * controle: quem quiser mexer entra na tela de operação.
 */
function progresso(culto: Culto): string | null {
  if (!culto.blocoAtualId) return null;
  const indice = culto.blocos.findIndex((b) => b.id === culto.blocoAtualId);
  if (indice === -1) return null;
  return `${indice + 1} de ${culto.blocos.length} blocos`;
}

/**
 * As ordens já montadas, como cartões — o "PRÓXIMAS ORDENS" da referência.
 *
 * Esta tela é só GESTÃO: quando montar, o que já existe, o que apagar.
 * Operar o culto ao vivo mora numa tela própria (`ExecucaoCulto`).
 *
 * Refeita em 20/08/2026 para o estilo da tela de referência: cada ordem
 * virou um cartão com selo de estado (Pronta/Rascunho/Ativa agora), os
 * blocos aparecem como chips (dá para conferir a sequência sem abrir o
 * editor) e os botões ganharam hierarquia — a ação principal do cartão é
 * "Operar", e "Editar"/"Duplicar" ficam em contorno fino ao lado.
 *
 * As passadas continuam escondidas atrás de um botão em vez de apagadas:
 * apagar sozinho o que alguém preparou seria destrutivo demais para o ganho,
 * mas deixá-las na lista afogaria o que interessa depois de alguns meses.
 */
export function ListaCultos({
  cultos,
  ativaId,
  onNova,
  onEditar,
  onDuplicar,
  onRemover,
  onOperar,
  onConcluir,
  onMarcarPronta,
  onModelos,
}: Props) {
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const hoje = hojeLocal();
  const anteriores = cultos.filter((c) => c.data < hoje);
  const proximas = cultos.filter((c) => c.data >= hoje);
  const visiveis = mostrarAnteriores ? cultos : proximas;

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <Rotulo className="first-letter:uppercase">{dataPorExtenso(hoje)}</Rotulo>
          <h1 className="mt-2 text-3xl leading-[1.05] font-extrabold tracking-[-0.03em] text-texto sm:text-[40px]">
            Ordem do Culto
          </h1>
          <p className="mt-2 max-w-xl text-sm text-texto-suave">
            Monte a sequência durante a semana. No domingo, abra o culto para
            operar com o cronômetro na tela.
          </p>
        </div>

        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <BotaoSecundario onClick={onModelos} className="flex-1 text-sm sm:h-13 sm:flex-none">
            Modelos
          </BotaoSecundario>
          <BotaoPrincipal onClick={onNova} className="flex-1 text-sm sm:h-13 sm:flex-none">
            + Nova ordem
          </BotaoPrincipal>
        </div>
      </header>

      <div className="mt-8">
        <Rotulo>Próximas ordens</Rotulo>

        {cultos.length === 0 && (
          <p className="mt-4 text-sm text-texto-suave">
            Nenhuma ordem montada ainda. Crie a primeira para o próximo culto.
          </p>
        )}

        {cultos.length > 0 && visiveis.length === 0 && (
          <p className="mt-4 text-sm text-texto-suave">
            Nenhuma ordem para hoje ou para os próximos dias.
          </p>
        )}

        {/* `auto-fit` com mínimo de 380px: dois cartões lado a lado em tela
            larga, um só no celular, sem breakpoint escrito à mão. */}
        <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
          {visiveis.map((culto) => {
            const noAr = culto.id === ativaId;
            const passou = culto.data < hoje;
            const rascunho = statusDoCulto(culto) === 'rascunho';
            const andamento = progresso(culto);

            return (
              <li key={culto.id}>
                <Cartao destacado={noAr} className="flex h-full flex-col gap-4 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-lg font-bold break-words text-texto first-letter:uppercase">
                        {culto.data === hoje
                          ? `Culto das ${culto.hora}`
                          : dataPorExtenso(culto.data)}
                      </p>
                      <Numero className="mt-1.5 block text-sm text-texto-suave">
                        {resumo(culto, hoje)}
                      </Numero>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {noAr && <Selo tom="acento">Ativa agora</Selo>}
                      {culto.concluidoEm ? (
                        <Selo tom="neutro">Concluída</Selo>
                      ) : (
                        <Selo tom={rascunho ? 'alerta' : 'sucesso'}>
                          {rascunho ? 'Rascunho' : 'Pronta'}
                        </Selo>
                      )}
                    </div>
                  </div>

                  {/* Chips dos blocos: a sequência conferível de relance, sem
                      abrir o editor. Teto de 3 + "+N" porque a partir daí a
                      linha quebra várias vezes e o cartão perde a forma. */}
                  {culto.blocos.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {culto.blocos.slice(0, 3).map((bloco) => (
                        <li
                          key={bloco.id}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-texto-suave"
                          style={{ background: 'var(--fundo-elevado)' }}
                        >
                          {bloco.titulo || 'Sem título'} ·{' '}
                          <Numero>{minutosDoBloco(bloco)} min</Numero>
                        </li>
                      ))}
                      {culto.blocos.length > 3 && (
                        <li
                          className="rounded-lg px-2.5 py-1.5 text-xs text-texto-fraco"
                          style={{ background: 'var(--fundo-elevado)' }}
                        >
                          +{culto.blocos.length - 3}
                        </li>
                      )}
                    </ul>
                  )}

                  {andamento && (
                    <p className="text-xs text-texto-fraco">Em andamento · {andamento}</p>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2.5">
                    {/* Rascunho troca a ação principal: enquanto não estiver
                        marcado como pronto ele não entra na eleição da ordem
                        ativa (ver `culto.ts`), então "deixar pronto" é o que
                        falta fazer nele — não operá-lo. */}
                    {rascunho && !passou ? (
                      <BotaoSecundario
                        onClick={() => void onMarcarPronta(culto.id)}
                        className="flex-1 text-sm"
                      >
                        Concluir rascunho
                      </BotaoSecundario>
                    ) : (
                      <BotaoSecundario
                        onClick={() => onOperar(culto.id)}
                        className="flex-1 text-sm"
                      >
                        {noAr ? 'Operar agora' : 'Abrir'}
                      </BotaoSecundario>
                    )}

                    <BotaoDiscreto onClick={() => onEditar(culto.id)}>Editar</BotaoDiscreto>
                    <BotaoDiscreto onClick={() => onDuplicar(culto.id)}>
                      Duplicar
                    </BotaoDiscreto>
                    <BotaoDiscreto
                      onClick={() => void onConcluir(culto.id, !culto.concluidoEm)}
                    >
                      {culto.concluidoEm ? 'Reabrir' : 'Concluir'}
                    </BotaoDiscreto>
                    <BotaoDiscreto
                      onClick={() => setConfirmandoId(culto.id)}
                      aria-label={`Apagar a ordem de ${dataPorExtenso(culto.data)} às ${culto.hora}`}
                      className="w-11 px-0"
                    >
                      ✕
                    </BotaoDiscreto>
                  </div>

                  {confirmandoId === culto.id && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-borda pt-4">
                      <p className="text-sm text-texto-suave">Apagar esta ordem?</p>
                      <button
                        type="button"
                        onClick={async () => {
                          setConfirmandoId(null);
                          await onRemover(culto.id);
                        }}
                        className="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-bold"
                        style={{ background: 'var(--urgente)', color: 'var(--fundo-cartao)' }}
                      >
                        Apagar
                      </button>
                      <BotaoDiscreto onClick={() => setConfirmandoId(null)}>
                        Cancelar
                      </BotaoDiscreto>
                    </div>
                  )}
                </Cartao>
              </li>
            );
          })}
        </ul>

        {anteriores.length > 0 && (
          <button
            type="button"
            onClick={() => setMostrarAnteriores((v) => !v)}
            className="mt-6 cursor-pointer text-sm text-texto-suave underline underline-offset-4 hover:text-texto"
          >
            {mostrarAnteriores
              ? 'Esconder anteriores'
              : `Ver anteriores (${anteriores.length})`}
          </button>
        )}
      </div>
    </div>
  );
}


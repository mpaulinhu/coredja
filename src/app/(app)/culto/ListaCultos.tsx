'use client';

import { useState } from 'react';
import { CabecalhoDaTela } from '@/components/CabecalhoDaTela';
import { hojeLocal, type Culto } from '@/lib/culto';

interface Props {
  cultos: Culto[];
  ativaId: string | null;
  onNova: () => void;
  onEditar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onRemover: (id: string) => Promise<void>;
  onAvancar: () => Promise<void>;
  onConcluir: (id: string, concluir: boolean) => Promise<void>;
}

/** "domingo, 24 de agosto" — o dia da semana importa mais que o ano aqui. */
function dataPorExtenso(data: string): string {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function resumo(culto: Culto): string {
  const minutos = culto.blocos.reduce((soma, b) => soma + (b.minutos || 0), 0);
  const blocos = culto.blocos.length === 1 ? '1 bloco' : `${culto.blocos.length} blocos`;
  return `${culto.hora} · ${blocos} · ${minutos} min`;
}

/** Agrupa as ordens por data, preservando a ordem cronológica de cada grupo. */
function agruparPorData(cultos: Culto[]): { data: string; ordens: Culto[] }[] {
  const grupos = new Map<string, Culto[]>();
  for (const culto of cultos) {
    const lista = grupos.get(culto.data) ?? [];
    lista.push(culto);
    grupos.set(culto.data, lista);
  }
  return Array.from(grupos.entries()).map(([data, ordens]) => ({ data, ordens }));
}

/**
 * As ordens já montadas, agrupadas por data — cada data pode ter mais de uma
 * (manhã/noite).
 *
 * As passadas ficam escondidas atrás de um botão em vez de apagadas: apagar
 * sozinho o que alguém preparou seria destrutivo demais para o ganho, mas
 * deixá-las na lista afogaria o que interessa depois de alguns meses. "Passada"
 * aqui considera a DATA, não a ordem individual — uma data de hoje continua no
 * grupo visível mesmo que uma das ordens dela já tenha sido concluída.
 */
export function ListaCultos({
  cultos,
  ativaId,
  onNova,
  onEditar,
  onDuplicar,
  onRemover,
  onAvancar,
  onConcluir,
}: Props) {
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const hoje = hojeLocal();
  const anteriores = cultos.filter((c) => c.data < hoje);
  const proximas = cultos.filter((c) => c.data >= hoje);
  const visiveis = mostrarAnteriores ? cultos : proximas;
  const grupos = agruparPorData(visiveis);

  return (
    <div className="w-full px-5 py-8 sm:px-8">
      <CabecalhoDaTela
        titulo="Ordem do Culto"
        instrucao="Cada culto tem sua data e horário. No domingo, quem está no controle vê a ordem certa se atualizar sozinha."
      />

      <div className="mt-4 flex justify-stretch sm:justify-end">
        <button
          type="button"
          onClick={onNova}
          className="h-12 w-full rounded-xl text-sm font-bold sm:w-auto sm:px-6"
          style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
        >
          + Nova ordem
        </button>
      </div>

      {cultos.length === 0 && (
        <p className="mt-4 text-sm text-texto-fraco">
          Nenhuma ordem montada ainda. Crie a primeira para o próximo culto.
        </p>
      )}

      {cultos.length > 0 && grupos.length === 0 && (
        <p className="mt-4 text-sm text-texto-fraco">
          Nenhuma ordem para hoje ou para os próximos dias.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-4">
        {grupos.map(({ data, ordens }) => {
          const passou = data < hoje;
          return (
            <li key={data}>
              <p
                className={`mb-2 text-xs font-semibold uppercase tracking-wide first-letter:uppercase ${passou ? 'text-texto-fraco' : 'text-texto-suave'}`}
              >
                {dataPorExtenso(data)}
              </p>

              <ul className="flex flex-col gap-2">
                {ordens.map((culto) => {
                  const noAr = culto.id === ativaId;
                  return (
                    <li
                      key={culto.id}
                      className="rounded-xl border bg-fundo-cartao px-4 py-3"
                      style={{ borderColor: noAr ? 'var(--acento)' : 'var(--borda)' }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`font-medium ${passou ? 'text-texto-fraco' : 'text-texto'}`}>
                            {resumo(culto)}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {noAr && (
                              <span
                                className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
                              >
                                Ativa agora
                              </span>
                            )}
                            {culto.concluidoEm && (
                              <span className="inline-block rounded-full border border-borda px-2 py-0.5 text-[11px] font-medium text-texto-fraco">
                                Concluída
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onEditar(culto.id)}
                            className="h-9 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicar(culto.id)}
                            className="h-9 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto"
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            onClick={() => onConcluir(culto.id, !culto.concluidoEm)}
                            className="h-9 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto"
                          >
                            {culto.concluidoEm ? 'Reabrir' : 'Concluir'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmandoId(culto.id)}
                            aria-label={`Apagar a ordem de ${dataPorExtenso(culto.data)} às ${culto.hora}`}
                            className="h-9 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {confirmandoId === culto.id && (
                        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-borda pt-3">
                          <p className="text-sm text-texto-suave">Apagar esta ordem?</p>
                          <button
                            type="button"
                            onClick={async () => {
                              setConfirmandoId(null);
                              await onRemover(culto.id);
                            }}
                            className="h-9 rounded-lg px-3 text-sm font-semibold"
                            style={{ background: 'var(--urgente)', color: 'var(--fundo-cartao)' }}
                          >
                            Apagar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmandoId(null)}
                            className="h-9 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}

                      {/* A sequência aparece só no card ativo: é o único em
                          que "Avançar" age, e sem ver o bloco atual o botão
                          parece não fazer nada. */}
                      {noAr && (
                        <div className="mt-3 border-t border-borda pt-3">
                          <ol className="flex flex-col gap-1">
                            {culto.blocos.map((bloco, i) => {
                              const atualIdx = culto.blocos.findIndex(
                                (b) => b.id === culto.blocoAtualId,
                              );
                              const agora = bloco.id === culto.blocoAtualId;
                              const feito = atualIdx >= 0 && i < atualIdx;
                              return (
                                <li key={bloco.id} className="flex items-center gap-2 text-sm">
                                  <span
                                    className="w-4 shrink-0 text-center text-xs"
                                    style={{
                                      color: agora ? 'var(--acento)' : 'var(--texto-fraco)',
                                    }}
                                    aria-hidden="true"
                                  >
                                    {feito ? '✓' : agora ? '▶' : ''}
                                  </span>
                                  <span
                                    className={
                                      agora
                                        ? 'font-semibold text-texto'
                                        : feito
                                          ? 'text-texto-fraco line-through'
                                          : 'text-texto-suave'
                                    }
                                  >
                                    {bloco.titulo || 'Sem título'}
                                  </span>
                                  <span className="ml-auto text-xs text-texto-fraco">
                                    {bloco.minutos} min
                                  </span>
                                </li>
                              );
                            })}
                          </ol>

                          <button
                            type="button"
                            onClick={onAvancar}
                            className="mt-3 h-11 w-full rounded-xl border border-borda text-sm font-medium text-texto-suave hover:text-texto"
                          >
                            {culto.blocoAtualId ? 'Avançar →' : 'Começar →'}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>

      {anteriores.length > 0 && (
        <button
          type="button"
          onClick={() => setMostrarAnteriores((v) => !v)}
          className="mt-4 text-sm text-texto-suave underline underline-offset-4 hover:text-texto"
        >
          {mostrarAnteriores
            ? 'Esconder anteriores'
            : `Ver anteriores (${anteriores.length})`}
        </button>
      )}
    </div>
  );
}

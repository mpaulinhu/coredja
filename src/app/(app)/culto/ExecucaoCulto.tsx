'use client';

import { useState } from 'react';
import type { Culto } from '@/lib/culto';

interface Props {
  culto: Culto | null;
  onAvancar: () => Promise<void>;
}

/**
 * Modo de execução: quem opera no domingo. Só leitura da sequência — o único
 * controle é "avançar". A tela some do vermelho para o normal conforme os
 * blocos passam, para dar noção de progresso de relance, sem precisar ler.
 *
 * Recebe já a ordem ATIVA (a de hoje, senão a próxima futura) — quem opera no
 * domingo não escolhe qual culto está acontecendo, o calendário escolhe. Ver
 * `culto.ts`.
 */
export function ExecucaoCulto({ culto, onAvancar }: Props) {
  const [avancando, setAvancando] = useState(false);

  if (!culto) {
    return (
      <div className="flex h-full items-center justify-center px-5 text-center">
        <p className="text-sm text-texto-fraco">
          Nenhuma ordem publicada para hoje.
        </p>
      </div>
    );
  }

  const indiceAtual = culto.blocos.findIndex((b) => b.id === culto.blocoAtualId);
  const terminou = culto.blocoAtualId !== null && indiceAtual === -1;
  const acabouAgora = indiceAtual === culto.blocos.length - 1;

  async function aoClicarAvancar() {
    setAvancando(true);
    try {
      await onAvancar();
    } finally {
      setAvancando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <p className="text-xs text-texto-fraco">
        {new Date(`${culto.data}T00:00:00`).toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        })}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-texto">
        Ordem do Culto
      </h1>

      <ol className="mt-6 flex flex-col gap-2">
        {culto.blocos.map((bloco, i) => {
          const passou = indiceAtual !== -1 && i < indiceAtual;
          const agora = i === indiceAtual;

          return (
            <li
              key={bloco.id}
              className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
              style={{
                borderColor: agora ? 'var(--acento)' : 'var(--borda)',
                background: agora ? 'var(--fundo-cartao)' : 'transparent',
              }}
            >
              <span
                className="w-5 shrink-0 text-center"
                style={{ color: agora ? 'var(--acento)' : 'var(--texto-fraco)' }}
                aria-hidden="true"
              >
                {passou ? '✓' : agora ? '▶' : ''}
              </span>
              <span
                className={`flex-1 text-base ${passou ? 'text-texto-fraco line-through' : 'text-texto'}`}
              >
                {bloco.titulo}
              </span>
              <span className="text-xs text-texto-fraco">{bloco.minutos} min</span>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={aoClicarAvancar}
        disabled={avancando || terminou}
        className="mt-6 h-14 w-full rounded-xl text-base font-bold disabled:opacity-50"
        style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
      >
        {terminou
          ? 'Culto encerrado'
          : indiceAtual === -1
            ? 'Começar'
            : acabouAgora
              ? 'Encerrar'
              : 'Avançar →'}
      </button>
    </div>
  );
}

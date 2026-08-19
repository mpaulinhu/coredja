'use client';

import type { Escala } from '@/lib/escala';

interface Props {
  escala: Escala | null;
  onMarcarPresenca: (id: string, presente: boolean) => Promise<void>;
}

/** Modo de confirmação: quem só marca presença, sem poder remontar a escala. */
export function ConfirmacaoEscala({ escala, onMarcarPresenca }: Props) {
  if (!escala) {
    return (
      <div className="flex h-full items-center justify-center px-5 text-center">
        <p className="text-sm text-texto-fraco">Ninguém montou a escala ainda.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col px-5 py-8">
      <p className="text-xs text-texto-fraco">
        {new Date(`${escala.data}T00:00:00`).toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        })}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-texto">
        Escala do Time
      </h1>

      <ul className="mt-6 flex flex-col gap-2">
        {escala.escalados.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-xl border border-borda bg-fundo-cartao px-4 py-3.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-texto-fraco">
                {e.funcao}
              </p>
              <p className="text-base text-texto">{e.nome}</p>
            </div>
            <button
              type="button"
              onClick={() => onMarcarPresenca(e.id, !e.presente)}
              className="h-10 rounded-lg px-4 text-sm font-semibold"
              style={
                e.presente
                  ? { background: 'var(--sucesso)', color: 'white' }
                  : {
                      background: 'transparent',
                      border: '1px solid var(--borda-forte)',
                      color: 'var(--texto-suave)',
                    }
              }
            >
              {e.presente ? '✓ Presente' : 'Confirmar'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

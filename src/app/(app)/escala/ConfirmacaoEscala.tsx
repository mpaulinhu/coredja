'use client';

import { CabecalhoDaTela } from '@/components/CabecalhoDaTela';
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
    <div className="flex h-full w-full flex-col px-5 py-8 sm:px-8">
      <p className="text-center text-xs text-texto-fraco first-letter:uppercase">
        {new Date(`${escala.data}T00:00:00`).toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        })}
      </p>
      <div className="mt-1">
        <CabecalhoDaTela titulo="Escala do Time" />
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {escala.escalados.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-xl border border-borda bg-fundo-cartao px-4 py-3"
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

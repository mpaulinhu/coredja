'use client';

import type { Papel } from '@/lib/papeis';

interface Props {
  opcoes: { valor: Papel; rotulo: string }[];
  selecionados: Papel[];
  onMudar: (papeis: Papel[]) => void;
}

/** Chips clicáveis para escolher um ou mais papéis. */
export function SeletorPapeis({ opcoes, selecionados, onMudar }: Props) {
  function alternar(papel: Papel) {
    onMudar(
      selecionados.includes(papel)
        ? selecionados.filter((p) => p !== papel)
        : [...selecionados, papel],
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map((op) => {
        const ativo = selecionados.includes(op.valor);
        return (
          <button
            key={op.valor}
            type="button"
            onClick={() => alternar(op.valor)}
            aria-pressed={ativo}
            className="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
            style={
              ativo
                ? { background: 'var(--acento)', borderColor: 'var(--acento)', color: 'var(--acento-texto)' }
                : { background: 'transparent', borderColor: 'var(--borda)', color: 'var(--texto-suave)' }
            }
          >
            {op.rotulo}
          </button>
        );
      })}
    </div>
  );
}

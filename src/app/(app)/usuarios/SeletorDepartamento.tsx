'use client';

import type { Departamento } from '@/lib/types';

interface Props {
  opcoes: Departamento[];
  /** null quando o formulário ainda não tem um departamento escolhido. */
  selecionado: string | null;
  onMudar: (slug: string) => void;
}

/** Cartões em lista, um departamento por vez — seleção única, mesmo padrão de `SeletorPapeis`. */
export function SeletorDepartamento({ opcoes, selecionado, onMudar }: Props) {
  return (
    <div role="radiogroup" className="flex flex-col gap-1.5">
      {opcoes.map((op) => {
        const ativo = op.slug === selecionado;
        return (
          <button
            key={op.slug}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onMudar(op.slug)}
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors"
            style={
              ativo
                ? { background: 'var(--acento)', borderColor: 'var(--acento)', color: 'var(--acento-texto)' }
                : { background: 'transparent', borderColor: 'var(--borda)', color: 'var(--texto-suave)' }
            }
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: op.cor }}
              aria-hidden="true"
            />
            <span className="text-sm font-medium">{op.nome}</span>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import type { Papel } from '@/lib/papeis';

interface Props {
  opcoes: { valor: Papel; rotulo: string; descricao?: string }[];
  /** null quando o formulário ainda não tem um cargo escolhido (ex: convite novo). */
  selecionado: Papel | null;
  onMudar: (papel: Papel) => void;
}

/** Cartões em lista, um cargo por vez — hierarquia de cargo único, sem multi-seleção. */
export function SeletorPapeis({ opcoes, selecionado, onMudar }: Props) {
  return (
    <div role="radiogroup" className="flex flex-col gap-1.5">
      {opcoes.map((op) => {
        const ativo = op.valor === selecionado;
        return (
          <button
            key={op.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onMudar(op.valor)}
            className="rounded-xl border px-3 py-2 text-left transition-colors"
            style={
              ativo
                ? { background: 'var(--acento)', borderColor: 'var(--acento)', color: 'var(--acento-texto)' }
                : { background: 'transparent', borderColor: 'var(--borda)', color: 'var(--texto-suave)' }
            }
          >
            <span className="text-sm font-medium">{op.rotulo}</span>
            {op.descricao && (
              <span
                className="block text-xs"
                style={{ color: ativo ? 'var(--acento-texto)' : 'var(--texto-fraco)', opacity: ativo ? 0.85 : 1 }}
              >
                {op.descricao}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

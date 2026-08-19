'use client';

import { useState } from 'react';
import type { Papel, Pessoa } from '@/lib/papeis';
import type { AreaResumo } from './TelaUsuarios';
import { TODOS_OS_PAPEIS } from './TelaUsuarios';
import { SeletorPapeis } from './SeletorPapeis';
import { SeletorAreas } from './SeletorAreas';

interface Props {
  pessoa: Pessoa;
  areas: AreaResumo[];
  onAtualizar: (papeis: Papel[], areasVisiveis: string[]) => Promise<void>;
  onRemover: () => Promise<void>;
}

/** Uma pessoa na lista: some/expande para editar, sem sair da página. */
export function LinhaPessoa({ pessoa, areas, onAtualizar, onRemover }: Props) {
  const [editando, setEditando] = useState(false);
  const [papeis, setPapeis] = useState<Papel[]>(pessoa.papeis);
  const [areasVisiveis, setAreasVisiveis] = useState<string[]>(pessoa.areasVisiveis ?? []);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    await onAtualizar(papeis, areasVisiveis);
    setSalvando(false);
    setEditando(false);
  }

  const rotulosPapeis = TODOS_OS_PAPEIS.filter((op) => pessoa.papeis.includes(op.valor))
    .map((op) => op.rotulo)
    .join(', ');

  return (
    <li className="rounded-xl border border-borda bg-fundo-cartao px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-texto">{pessoa.nome}</p>
          <p className="text-sm text-texto-suave">{pessoa.email}</p>
          <p className="mt-0.5 text-xs text-texto-fraco">{rotulosPapeis || 'Sem papel'}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="h-9 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto"
          >
            {editando ? 'Fechar' : 'Editar'}
          </button>
          <button
            type="button"
            onClick={onRemover}
            aria-label={`Remover acesso de ${pessoa.nome}`}
            className="h-9 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto"
          >
            ✕
          </button>
        </div>
      </div>

      {editando && (
        <div className="mt-4 flex flex-col gap-3 border-t border-borda pt-4">
          <div>
            <p className="mb-1.5 text-sm text-texto-suave">Papéis</p>
            <SeletorPapeis opcoes={TODOS_OS_PAPEIS} selecionados={papeis} onMudar={setPapeis} />
          </div>

          {areas.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm text-texto-suave">Vê recados de</p>
              <SeletorAreas
                areas={areas}
                selecionadas={areasVisiveis}
                onMudar={setAreasVisiveis}
              />
            </div>
          )}

          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="h-10 self-start rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      )}
    </li>
  );
}

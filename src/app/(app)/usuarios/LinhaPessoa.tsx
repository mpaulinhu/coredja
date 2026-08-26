'use client';

import { useState } from 'react';
import type { Papel, Pessoa } from '@/lib/papeis';
import type { Departamento } from '@/lib/types';
import type { AreaResumo } from './TelaUsuarios';
import { TODOS_OS_PAPEIS } from './TelaUsuarios';
import { SeletorPapeis } from './SeletorPapeis';
import { SeletorAbas } from './SeletorAbas';
import { SeletorAreas } from './SeletorAreas';
import { SeletorDepartamento } from './SeletorDepartamento';

interface Props {
  pessoa: Pessoa;
  areas: AreaResumo[];
  departamentos: Departamento[];
  onAtualizar: (
    papel: Papel,
    departamento: string | null,
    areasVisiveis: string[],
    abas: string[] | null,
  ) => Promise<void>;
  onRemover: () => Promise<void>;
}

/** Uma pessoa na lista: some/expande para editar, sem sair da página. */
export function LinhaPessoa({ pessoa, areas, departamentos, onAtualizar, onRemover }: Props) {
  const [editando, setEditando] = useState(false);
  const [papel, setPapel] = useState<Papel>(pessoa.papel);
  const [departamento, setDepartamento] = useState<string | null>(pessoa.departamento ?? null);
  const [areasVisiveis, setAreasVisiveis] = useState<string[]>(pessoa.areasVisiveis ?? []);
  // `null` = sem escolha própria, segue o padrão do cargo.
  const [abas, setAbas] = useState<string[] | null>(pessoa.abas ?? null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    // Se o departamento mudou para um que estava marcado como área extra, o
    // valor antigo fica redundante — sai aqui em vez de virar dado morto.
    await onAtualizar(
      papel,
      departamento,
      areasVisiveis.filter((slug) => slug !== departamento),
      abas,
    );
    setSalvando(false);
    setEditando(false);
  }

  const rotuloPapel = TODOS_OS_PAPEIS.find((op) => op.valor === pessoa.papel)?.rotulo;

  // O acesso à conversa do próprio departamento já vem do campo Departamento —
  // oferecê-lo aqui de novo sugeriria, erradamente, uma conversa consigo mesmo.
  const areasExtras = areas.filter((a) => a.slug !== departamento);

  return (
    <li className="rounded-xl border border-borda bg-fundo-cartao px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-texto">{pessoa.nome}</p>
          <p className="text-sm text-texto-suave">{pessoa.email}</p>
          <p className="mt-0.5 text-xs text-texto-fraco">{rotuloPapel ?? 'Sem papel'}</p>
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
            <p className="mb-1.5 text-sm text-texto-suave">Papel</p>
            <SeletorPapeis opcoes={TODOS_OS_PAPEIS} selecionado={papel} onMudar={setPapel} />
          </div>

          {departamentos.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm text-texto-suave">Departamento</p>
              <SeletorDepartamento
                opcoes={departamentos}
                selecionado={departamento}
                onMudar={setDepartamento}
              />
            </div>
          )}

          {areasExtras.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm text-texto-suave">
                Pode conversar com{' '}
                <span className="text-texto-fraco">· pode marcar mais de um</span>
              </p>
              <SeletorAreas
                areas={areasExtras}
                selecionadas={areasVisiveis}
                onMudar={setAreasVisiveis}
              />
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm text-texto-suave">
              Telas no menu{' '}
              <span className="text-texto-fraco">· o que aparece pra ela</span>
            </p>
            <SeletorAbas papel={papel} selecionadas={abas} onMudar={setAbas} />
          </div>

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

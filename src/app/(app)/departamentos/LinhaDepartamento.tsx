'use client';

import { useState } from 'react';
import { ehSlugReservado } from '@/lib/departamento-validacao';
import type { Departamento } from '@/lib/types';
import { SeletorCor } from './SeletorCor';

interface Props {
  departamento: Departamento;
  /** false para quem só pode ver a lista — ver `podeEditar` em `TelaDepartamentos`. */
  podeEditar: boolean;
  onAtualizar: (nome: string, cor: string) => Promise<void>;
  onRemover: () => Promise<void>;
}

/** Um departamento na lista: expande para editar nome e cor, sem sair da página. */
export function LinhaDepartamento({
  departamento,
  podeEditar,
  onAtualizar,
  onRemover,
}: Props) {
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [nome, setNome] = useState(departamento.nome);
  const [cor, setCor] = useState(departamento.cor);
  const [salvando, setSalvando] = useState(false);

  const reservado = ehSlugReservado(departamento.slug);

  async function salvar() {
    setSalvando(true);
    await onAtualizar(nome.trim(), cor);
    setSalvando(false);
    setEditando(false);
  }

  return (
    <li className="rounded-xl border border-borda bg-fundo-cartao px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ background: departamento.cor }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-texto">{departamento.nome}</p>
            <p className="truncate font-mono text-xs text-texto-fraco">
              {departamento.slug}
            </p>
          </div>
          {reservado && (
            <span
              className="shrink-0 rounded-full border border-borda px-2 py-0.5 text-[11px] text-texto-fraco"
              title="Dá o aparato de urgência às conversas — não pode ser apagado"
            >
              reservado
            </span>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {podeEditar && (
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="h-9 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto"
          >
            {editando ? 'Fechar' : 'Editar'}
          </button>
          )}
          {/* O botão some no reservado, mas quem garante é o servidor: a rota
              recusa o DELETE mesmo se a chamada vier de fora da tela. */}
          {podeEditar && !reservado && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              aria-label={`Apagar o departamento ${departamento.nome}`}
              className="h-9 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {confirmando && (
        <div className="mt-3 flex flex-col gap-3 border-t border-borda pt-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="text-sm text-texto-suave">
            Apagar {departamento.nome}? As conversas antigas somem da lista.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                setConfirmando(false);
                await onRemover();
              }}
              className="h-9 rounded-lg px-3 text-sm font-semibold"
              style={{ background: 'var(--urgente)', color: 'var(--fundo-cartao)' }}
            >
              Apagar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="h-9 rounded-lg border border-borda px-3 text-sm text-texto-suave hover:text-texto"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {editando && (
        <div className="mt-4 flex flex-col gap-3 border-t border-borda pt-4">
          <div>
            <label
              htmlFor={`nome-${departamento.slug}`}
              className="mb-1.5 block text-sm text-texto-suave"
            >
              Nome
            </label>
            <input
              id={`nome-${departamento.slug}`}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-xl border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto"
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm text-texto-suave">Cor</p>
            <SeletorCor valor={cor} onMudar={setCor} idPrefixo={departamento.slug} />
          </div>

          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !nome.trim()}
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

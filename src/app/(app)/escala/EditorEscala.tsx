'use client';

import { useState } from 'react';
import { FUNCOES, type Escala, type Escalado, type Funcao } from '@/lib/escala';

interface Props {
  escala: Escala | null;
  onSalvar: (
    data: string,
    escalados: Omit<Escalado, 'presente'>[],
  ) => Promise<{ ok: true } | { ok: false; erro: string }>;
  onMarcarPresenca: (id: string, presente: boolean) => Promise<void>;
}

function proximoDomingo(): string {
  const hoje = new Date();
  const diasAteDomingo = (7 - hoje.getDay()) % 7 || 7;
  const alvo = new Date(hoje);
  alvo.setDate(hoje.getDate() + diasAteDomingo);
  return alvo.toISOString().slice(0, 10);
}

type Rascunho = Omit<Escalado, 'presente'>;

function novoEscalado(funcao: Funcao): Rascunho {
  return { id: crypto.randomUUID(), funcao, nome: '' };
}

/** Modo de montagem: o coordenador escolhe quem faz cada função. */
export function EditorEscala({ escala, onSalvar, onMarcarPresenca }: Props) {
  const [data, setData] = useState(escala?.data ?? proximoDomingo());
  const [escalados, setEscalados] = useState<Rascunho[]>(
    escala?.escalados.length
      ? escala.escalados.map((e) => ({ id: e.id, funcao: e.funcao, nome: e.nome }))
      : FUNCOES.map((f) => novoEscalado(f)),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function atualizarNome(id: string, nome: string) {
    setSalvo(false);
    setEscalados((atuais) => atuais.map((e) => (e.id === id ? { ...e, nome } : e)));
  }

  function removerLinha(id: string) {
    setSalvo(false);
    setEscalados((atuais) => atuais.filter((e) => e.id !== id));
  }

  function adicionarLinha(funcao: Funcao) {
    setSalvo(false);
    setEscalados((atuais) => [...atuais, novoEscalado(funcao)]);
  }

  async function salvar() {
    const preenchidos = escalados
      .map((e) => ({ ...e, nome: e.nome.trim() }))
      .filter((e) => e.nome);

    if (preenchidos.length === 0) {
      setErro('Escale ao menos uma pessoa.');
      return;
    }

    setErro(null);
    setSalvando(true);
    const resultado = await onSalvar(data, preenchidos);
    setSalvando(false);

    if (resultado.ok) {
      setEscalados(preenchidos);
      setSalvo(true);
    } else {
      setErro(resultado.erro);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-texto">Escala do Time</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Escolha quem faz cada função. A pessoa confirma presença no dia.
      </p>

      <label htmlFor="data" className="mt-6 mb-1.5 block text-sm text-texto-suave">
        Data
      </label>
      <input
        id="data"
        type="date"
        value={data}
        onChange={(e) => {
          setData(e.target.value);
          setSalvo(false);
        }}
        className="w-full rounded-xl border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto"
      />

      <div className="mt-6 flex flex-col gap-2">
        {FUNCOES.map((funcao) => {
          const linhas = escalados.filter((e) => e.funcao === funcao);
          return (
            <div key={funcao}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-texto-fraco">
                {funcao}
              </p>
              <div className="flex flex-col gap-2">
                {linhas.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <input
                      value={e.nome}
                      onChange={(ev) => atualizarNome(e.id, ev.target.value)}
                      placeholder="Nome da pessoa"
                      className="min-w-0 flex-1 rounded-lg border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto placeholder:text-texto-fraco"
                    />
                    <button
                      type="button"
                      onClick={() => removerLinha(e.id)}
                      aria-label={`Remover linha de ${funcao}`}
                      className="text-texto-fraco hover:text-texto"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => adicionarLinha(funcao)}
                  className="h-9 rounded-lg border border-dashed border-borda text-sm text-texto-suave hover:border-borda-forte hover:text-texto"
                >
                  + Adicionar em {funcao}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {erro && (
        <p role="alert" className="mt-4 text-sm" style={{ color: 'var(--urgente)' }}>
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="mt-6 h-14 w-full rounded-xl text-base font-bold disabled:opacity-60"
        style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
      >
        {salvando ? 'Salvando…' : salvo ? 'Salvo ✓' : 'Publicar escala'}
      </button>

      {escala && escala.escalados.length > 0 && (
        <div className="mt-8 border-t border-borda pt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-fraco">
            Presença confirmada
          </p>
          <ul className="flex flex-col gap-2">
            {escala.escalados.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-borda px-3 py-2 text-sm"
              >
                <span className="text-texto-suave">
                  {e.nome} — {e.funcao}
                </span>
                <button
                  type="button"
                  onClick={() => onMarcarPresenca(e.id, !e.presente)}
                  className="text-xs font-semibold"
                  style={{ color: e.presente ? 'var(--sucesso)' : 'var(--texto-fraco)' }}
                >
                  {e.presente ? '✓ Presente' : 'Marcar presença'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

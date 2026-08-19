'use client';

import { useState } from 'react';
import type { Bloco, Culto } from '@/lib/culto';

interface Props {
  culto: Culto | null;
  onSalvar: (
    data: string,
    blocos: Bloco[],
  ) => Promise<{ ok: true } | { ok: false; erro: string }>;
  onAvancar: () => Promise<void>;
}

function proximoDomingo(): string {
  const hoje = new Date();
  const diasAteDomingo = (7 - hoje.getDay()) % 7 || 7;
  const alvo = new Date(hoje);
  alvo.setDate(hoje.getDate() + diasAteDomingo);
  return alvo.toISOString().slice(0, 10);
}

function novoBloco(): Bloco {
  return { id: crypto.randomUUID(), titulo: '', minutos: 10 };
}

/**
 * Modo de montagem: quem prepara na semana. Arrastar de verdade ficaria bom,
 * mas exigiria uma biblioteca nova só para isto — os botões de subir/descer
 * fazem o mesmo trabalho, sem dependência, para uma lista de meia dúzia de
 * blocos.
 */
export function EditorCulto({ culto, onSalvar, onAvancar }: Props) {
  const [data, setData] = useState(culto?.data ?? proximoDomingo());
  const [blocos, setBlocos] = useState<Bloco[]>(
    culto?.blocos.length ? culto.blocos : [novoBloco()],
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  function atualizarBloco(id: string, campo: 'titulo' | 'minutos', valor: string) {
    setSalvo(false);
    setBlocos((atuais) =>
      atuais.map((b) =>
        b.id === id
          ? { ...b, [campo]: campo === 'minutos' ? Number(valor) || 0 : valor }
          : b,
      ),
    );
  }

  function moverBloco(id: string, direcao: -1 | 1) {
    setSalvo(false);
    setBlocos((atuais) => {
      const i = atuais.findIndex((b) => b.id === id);
      const j = i + direcao;
      if (j < 0 || j >= atuais.length) return atuais;
      const copia = [...atuais];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }

  function removerBloco(id: string) {
    setSalvo(false);
    setBlocos((atuais) => atuais.filter((b) => b.id !== id));
  }

  async function salvar() {
    const preenchidos = blocos
      .map((b) => ({ ...b, titulo: b.titulo.trim() }))
      .filter((b) => b.titulo);

    if (preenchidos.length === 0) {
      setErro('Adicione ao menos um bloco com título.');
      return;
    }

    setErro(null);
    setSalvando(true);
    const resultado = await onSalvar(data, preenchidos);
    setSalvando(false);

    if (resultado.ok) {
      setBlocos(preenchidos);
      setSalvo(true);
    } else {
      setErro(resultado.erro);
    }
  }

  const totalMinutos = blocos.reduce((soma, b) => soma + (b.minutos || 0), 0);
  const emAndamento = culto?.blocoAtualId != null;

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-texto">
        Ordem do Culto
      </h1>
      <p className="mt-1 text-sm text-texto-suave">
        Monte a sequência. Quem estiver no domingo vê isto se atualizar
        sozinho.
      </p>

      {emAndamento && (
        <div className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--urgente)', color: 'var(--urgente)' }}>
          O culto está em andamento. Salvar aqui reinicia a execução do
          início.
        </div>
      )}

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

      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-texto-suave">Blocos</span>
        <span className="text-xs text-texto-fraco">{totalMinutos} min ao todo</span>
      </div>

      <ul className="mt-2 flex flex-col gap-2">
        {blocos.map((bloco, i) => (
          <li
            key={bloco.id}
            className="flex items-center gap-2 rounded-xl border border-borda bg-fundo-cartao px-3 py-2.5"
          >
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => moverBloco(bloco.id, -1)}
                disabled={i === 0}
                aria-label="Mover para cima"
                className="text-texto-fraco hover:text-texto disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moverBloco(bloco.id, 1)}
                disabled={i === blocos.length - 1}
                aria-label="Mover para baixo"
                className="text-texto-fraco hover:text-texto disabled:opacity-30"
              >
                ▼
              </button>
            </div>

            <input
              value={bloco.titulo}
              onChange={(e) => atualizarBloco(bloco.id, 'titulo', e.target.value)}
              placeholder="Ex: Louvor"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-texto placeholder:text-texto-fraco focus:outline-none"
            />

            <input
              type="number"
              min={0}
              value={bloco.minutos}
              onChange={(e) => atualizarBloco(bloco.id, 'minutos', e.target.value)}
              aria-label="Minutos"
              className="w-14 rounded-lg border border-borda bg-fundo px-2 py-1 text-right text-sm text-texto"
            />
            <span className="text-xs text-texto-fraco">min</span>

            <button
              type="button"
              onClick={() => removerBloco(bloco.id)}
              aria-label="Remover bloco"
              className="text-texto-fraco hover:text-texto"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setBlocos((atuais) => [...atuais, novoBloco()])}
        className="mt-3 h-11 w-full rounded-xl border border-dashed border-borda text-sm text-texto-suave hover:border-borda-forte hover:text-texto"
      >
        + Adicionar bloco
      </button>

      {erro && (
        <p role="alert" className="mt-4 text-sm" style={{ color: 'var(--urgente)' }}>
          {erro}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="h-14 flex-1 rounded-xl text-base font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--acento)' }}
        >
          {salvando ? 'Salvando…' : salvo ? 'Salvo ✓' : 'Publicar'}
        </button>

        {culto && (
          <button
            type="button"
            onClick={onAvancar}
            className="h-14 rounded-xl border border-borda px-5 text-sm font-medium text-texto-suave hover:text-texto"
          >
            Avançar →
          </button>
        )}
      </div>
    </div>
  );
}

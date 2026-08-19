'use client';

import { useState } from 'react';
import type { Bloco, Culto } from '@/lib/culto';

interface Props {
  /** null quando é uma ordem nova. */
  culto: Culto | null;
  /** Datas que já têm ordem — para avisar antes de sobrescrever sem querer. */
  datasOcupadas: string[];
  onSalvar: (
    data: string,
    blocos: Bloco[],
    idAnterior?: string,
  ) => Promise<{ ok: true } | { ok: false; erro: string }>;
  onVoltar: () => void;
}

function proximoDomingo(): string {
  const hoje = new Date();
  const diasAteDomingo = (7 - hoje.getDay()) % 7 || 7;
  const alvo = new Date(hoje);
  alvo.setDate(hoje.getDate() + diasAteDomingo);
  const mes = String(alvo.getMonth() + 1).padStart(2, '0');
  const dia = String(alvo.getDate()).padStart(2, '0');
  return `${alvo.getFullYear()}-${mes}-${dia}`;
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
export function EditorCulto({ culto, datasOcupadas, onSalvar, onVoltar }: Props) {
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
    // `culto.id` vai junto para o servidor saber que é uma ordem existente
    // mudando de data — nesse caso ele move, em vez de deixar a antiga para trás.
    const resultado = await onSalvar(data, preenchidos, culto?.id);
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
  // Só é conflito se a data escolhida for de OUTRA ordem: reeditar a própria
  // data da ordem aberta é o comportamento normal, não uma sobrescrita.
  const conflitaComOutra = datasOcupadas.includes(data) && data !== culto?.data;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <button
        type="button"
        onClick={onVoltar}
        className="text-sm text-texto-suave hover:text-texto"
      >
        ← Todas as ordens
      </button>

      <h1 className="mt-3 text-2xl font-bold tracking-tight text-texto">
        {culto ? 'Editar ordem' : 'Nova ordem'}
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

      {conflitaComOutra && (
        <div className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--urgente)', color: 'var(--urgente)' }}>
          Já existe uma ordem nesta data. Salvar substitui a que está lá.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-borda bg-fundo-elevado p-5 sm:p-6">
        <label htmlFor="data" className="mb-1.5 block text-sm text-texto-suave">
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
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="h-14 flex-1 rounded-xl text-base font-bold disabled:opacity-60"
          style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
        >
          {salvando ? 'Salvando…' : salvo ? 'Salvo ✓' : 'Publicar'}
        </button>

        <button
          type="button"
          onClick={onVoltar}
          className="h-14 rounded-xl border border-borda px-5 text-sm font-medium text-texto-suave hover:text-texto"
        >
          Concluir
        </button>
      </div>
    </div>
  );
}

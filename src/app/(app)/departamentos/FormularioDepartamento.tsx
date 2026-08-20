'use client';

import { useState } from 'react';
import { slugDoNome } from '@/lib/departamento-validacao';
import { SeletorCor } from './SeletorCor';

interface Props {
  onCriar: (nome: string, cor: string) => Promise<{ ok: true } | { ok: false; erro: string }>;
}

/** Cor inicial de um departamento novo — a de destaque do produto. */
const COR_PADRAO = '#e4814e';

export function FormularioDepartamento({ onCriar }: Props) {
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(COR_PADRAO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Mesma função que o servidor usa, então o que aparece aqui é exatamente o
  // que vai ser gravado — não é uma segunda regra que pode divergir.
  const slug = slugDoNome(nome.trim());

  async function criar() {
    if (!nome.trim()) {
      setErro('Informe o nome do departamento.');
      return;
    }
    setErro(null);
    setEnviando(true);
    const resultado = await onCriar(nome.trim(), cor);
    setEnviando(false);

    if (resultado.ok) {
      setNome('');
      setCor(COR_PADRAO);
    } else {
      setErro(resultado.erro);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <label htmlFor="novo-nome" className="mb-1.5 block text-sm text-texto-suave">
          Nome
        </label>
        <input
          id="novo-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Louvor"
          className="w-full rounded-xl border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto"
        />
        {slug && (
          <p className="mt-1.5 text-xs text-texto-fraco">
            Endereço interno: <span className="font-mono text-texto-suave">{slug}</span> · não
            muda depois de criado
          </p>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm text-texto-suave">Cor</p>
        <SeletorCor valor={cor} onMudar={setCor} idPrefixo="novo" />
      </div>

      {erro && (
        <p role="alert" className="text-sm" style={{ color: 'var(--urgente)' }}>
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={criar}
        disabled={enviando}
        className="h-11 rounded-lg text-sm font-semibold disabled:opacity-50"
        style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
      >
        {enviando ? 'Criando…' : 'Criar departamento'}
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { Papel } from '@/lib/papeis';
import type { AreaResumo } from './TelaUsuarios';
import { TODOS_OS_PAPEIS } from './TelaUsuarios';
import { SeletorPapeis } from './SeletorPapeis';
import { SeletorAreas } from './SeletorAreas';

interface Props {
  areas: AreaResumo[];
  onConvidar: (
    nome: string,
    email: string,
    papeis: Papel[],
    areasVisiveis: string[],
  ) => Promise<{ ok: true } | { ok: false; erro: string }>;
}

export function FormularioConvite({ areas, onConvidar }: Props) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papeis, setPapeis] = useState<Papel[]>([]);
  const [areasVisiveis, setAreasVisiveis] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function convidar() {
    if (!nome.trim() || !email.trim() || papeis.length === 0) {
      setErro('Preencha nome, e-mail, e escolha ao menos um papel.');
      return;
    }
    setErro(null);
    setEnviando(true);
    const resultado = await onConvidar(nome.trim(), email.trim(), papeis, areasVisiveis);
    setEnviando(false);

    if (resultado.ok) {
      setNome('');
      setEmail('');
      setPapeis([]);
      setAreasVisiveis([]);
    } else {
      setErro(resultado.erro);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="nome" className="mb-1.5 block text-sm text-texto-suave">
            Nome
          </label>
          <input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-xl border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-texto-suave">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-borda bg-fundo-cartao px-3 py-2.5 text-[16px] text-texto"
          />
        </div>
      </div>

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

      {erro && (
        <p role="alert" className="text-sm" style={{ color: 'var(--urgente)' }}>
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={convidar}
        disabled={enviando}
        className="h-11 rounded-lg text-sm font-semibold disabled:opacity-50"
        style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
      >
        {enviando ? 'Convidando…' : 'Convidar'}
      </button>
    </div>
  );
}

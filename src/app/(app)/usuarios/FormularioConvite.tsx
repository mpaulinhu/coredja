'use client';

import { useState } from 'react';
import type { Papel } from '@/lib/papeis';
import type { Departamento } from '@/lib/types';
import type { AreaResumo } from './TelaUsuarios';
import { TODOS_OS_PAPEIS } from './TelaUsuarios';
import { SeletorPapeis } from './SeletorPapeis';
import { SeletorAbas } from './SeletorAbas';
import { SeletorAreas } from './SeletorAreas';
import { SeletorDepartamento } from './SeletorDepartamento';

interface Props {
  areas: AreaResumo[];
  departamentos: Departamento[];
  onConvidar: (
    nome: string,
    email: string,
    papel: Papel,
    departamento: string | null,
    areasVisiveis: string[],
    abas: string[] | null,
  ) => Promise<{ ok: true } | { ok: false; erro: string }>;
}

export function FormularioConvite({ areas, departamentos, onConvidar }: Props) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Papel | null>(null);
  const [departamento, setDepartamento] = useState<string | null>(null);
  const [areasVisiveis, setAreasVisiveis] = useState<string[]>([]);
  // `null` = segue o padrão do cargo escolhido. Ver `abas` em `Pessoa`.
  const [abas, setAbas] = useState<string[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O acesso à conversa do próprio departamento já vem do campo Departamento —
  // oferecê-lo aqui de novo sugeriria, erradamente, uma conversa consigo mesmo.
  const areasExtras = areas.filter((a) => a.slug !== departamento);

  async function convidar() {
    if (!nome.trim() || !email.trim() || !papel) {
      setErro('Preencha nome, e-mail, e escolha um papel.');
      return;
    }
    setErro(null);
    setEnviando(true);
    const resultado = await onConvidar(
      nome.trim(),
      email.trim(),
      papel,
      departamento,
      areasVisiveis.filter((slug) => slug !== departamento),
      abas,
    );
    setEnviando(false);

    if (resultado.ok) {
      setNome('');
      setEmail('');
      setPapel(null);
      setDepartamento(null);
      setAreasVisiveis([]);
      setAbas(null);
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

      {/* Só depois de escolher o papel: as abas disponíveis dependem dele, e
          uma lista vazia antes disso não diria nada a quem está preenchendo. */}
      {papel && (
        <div>
          <p className="mb-1.5 text-sm text-texto-suave">
            Telas no menu{' '}
            <span className="text-texto-fraco">· o que aparece pra ela</span>
          </p>
          <SeletorAbas papel={papel} selecionadas={abas} onMudar={setAbas} />
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

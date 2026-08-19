'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { entrar } from '@/lib/auth-cliente';

/**
 * Tela de login das pessoas da igreja (líder, coordenador, operador).
 *
 * Não confundir com o link das áreas (`/a/[chave]`): a Cantina e o Kids não
 * passam por aqui, e continuam com o link secreto — ver `papeis.ts`.
 */
export default function PaginaEntrar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      router.push('/painel');
    } catch {
      // O Firebase distingue "usuário não existe" de "senha errada", mas
      // expor essa diferença ajuda quem tenta adivinhar credencial alheia
      // mais do que ajuda quem esqueceu a própria senha.
      setErro('E-mail ou senha incorretos.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <form onSubmit={aoEnviar} className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-texto">Coredja</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Entre com sua conta da igreja.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-texto-suave">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-borda bg-fundo-cartao px-3 py-3 text-[16px] text-texto placeholder:text-texto-fraco"
            />
          </div>

          <div>
            <label htmlFor="senha" className="mb-1.5 block text-sm text-texto-suave">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-xl border border-borda bg-fundo-cartao px-3 py-3 text-[16px] text-texto placeholder:text-texto-fraco"
            />
          </div>

          {erro && (
            <p role="alert" className="text-sm" style={{ color: 'var(--urgente)' }}>
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-2 h-14 w-full rounded-xl text-base font-bold text-white disabled:opacity-60"
            style={{ background: 'var(--acento)' }}
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useState, type FormEvent } from 'react';
import { trocarSenha } from '@/lib/auth-cliente';
import { IconeOlho, IconeOlhoFechado } from '@/components/IconesFormulario';

interface Props {
  aoFechar: () => void;
}

/** Modal simples para quem já está logado trocar a própria senha. */
export function ModalTrocarSenha({ aoFechar }: Props) {
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function aoEnviar(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await trocarSenha(senha);
      setSucesso(true);
    } catch (falha) {
      const codigo = (falha as { code?: string }).code;
      setErro(
        codigo === 'auth/requires-recent-login'
          ? 'Por segurança, saia e entre de novo antes de trocar a senha.'
          : 'Não foi possível trocar a senha. Tente de novo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5">
      <div className="w-full max-w-sm rounded-2xl border border-borda bg-fundo-elevado p-5">
        <h2 className="text-base font-semibold text-texto">Trocar senha</h2>

        {sucesso ? (
          <>
            <p className="mt-3 text-sm text-texto-suave">Senha trocada com sucesso.</p>
            <button
              type="button"
              onClick={aoFechar}
              className="mt-4 h-10 w-full rounded-lg text-sm font-semibold"
              style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
            >
              Ok
            </button>
          </>
        ) : (
          <form onSubmit={aoEnviar} className="mt-3 flex flex-col gap-3">
            <div>
              <label htmlFor="nova-senha" className="mb-1.5 block text-sm text-texto-suave">
                Nova senha
              </label>
              <div className="relative">
                <input
                  id="nova-senha"
                  type={senhaVisivel ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoFocus
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full rounded-xl border border-borda bg-fundo-cartao px-3 py-2.5 pr-11 text-[16px] text-texto"
                />
                <button
                  type="button"
                  onClick={() => setSenhaVisivel((v) => !v)}
                  aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={senhaVisivel}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-texto-fraco hover:text-texto-suave"
                >
                  {senhaVisivel ? <IconeOlhoFechado /> : <IconeOlho />}
                </button>
              </div>
            </div>

            {erro && (
              <p role="alert" className="text-sm" style={{ color: 'var(--urgente)' }}>
                {erro}
              </p>
            )}

            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={aoFechar}
                className="h-10 flex-1 rounded-lg border border-borda text-sm text-texto-suave hover:text-texto"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="h-10 flex-1 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--acento)', color: 'var(--acento-texto)' }}
              >
                {enviando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

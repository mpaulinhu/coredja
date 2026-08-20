'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { escutarSessao, sair } from '@/lib/auth-cliente';
import { useTema } from '@/lib/tema-cliente';
import { IconeLua, IconeSol } from '@/components/IconesFormulario';
import { ModalTrocarSenha } from './ModalTrocarSenha';

/**
 * Barra a entrada nas telas internas para quem não está logado.
 *
 * Envolve `(app)/layout.tsx` inteiro. Enquanto o Firebase confirma se existe
 * sessão salva, mostra um estado neutro em vez de piscar a tela e mandar para
 * o login à toa. Sem sessão, redireciona para `/entrar`.
 *
 * Isto confere só que existe uma PESSOA logada — não confere o papel dela.
 * Cada tela ainda decide o que uma pessoa com tal papel pode fazer ali
 * dentro (ver `papeis.ts`); este componente só barra visitante anônimo.
 */
export function ExigeLogin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<'verificando' | 'dentro' | 'fora'>(
    'verificando',
  );
  const [email, setEmail] = useState<string | null>(null);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const { tema, alternarTema } = useTema();

  useEffect(() => {
    return escutarSessao((usuario) => {
      if (usuario) {
        setEmail(usuario.email);
        setEstado('dentro');
      } else {
        setEstado('fora');
        router.replace('/entrar');
      }
    });
  }, [router]);

  if (estado !== 'dentro') {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-sm text-texto-fraco">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-borda px-5 py-2.5 text-xs text-texto-fraco">
        <span>{email}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={alternarTema}
            aria-label={tema === 'escuro' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className="text-texto-suave hover:text-texto"
          >
            {tema === 'escuro' ? <IconeLua /> : <IconeSol />}
          </button>
          <button
            type="button"
            onClick={() => setTrocandoSenha(true)}
            className="text-texto-suave hover:text-texto"
          >
            Trocar senha
          </button>
          <button
            type="button"
            onClick={() => sair()}
            className="text-texto-suave hover:text-texto"
          >
            Sair
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      {trocandoSenha && <ModalTrocarSenha aoFechar={() => setTrocandoSenha(false)} />}
    </div>
  );
}

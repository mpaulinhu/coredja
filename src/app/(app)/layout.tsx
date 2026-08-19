import type { ReactNode } from 'react';
import { ExigeLogin } from '@/components/casca/ExigeLogin';
import { MenuLateral } from '@/components/casca/MenuLateral';

/**
 * Casca das telas internas do Coredja (Painel, e as que vierem depois).
 *
 * `(app)` é um route group do Next: as pastas dentro dele ganham este layout
 * em volta, mas o nome entre parênteses NÃO entra na URL. `/painel` continua
 * sendo `/painel` — nada muda para quem já tem o link salvo.
 *
 * A home (`/`) e o link das áreas (`/a/[chave]`) ficam FORA deste grupo, de
 * propósito: são páginas para quem está fora do Coredja (a área que só manda
 * recado), e não devem ganhar o menu de navegação interna nem exigir login.
 *
 * `ExigeLogin` envolve tudo: sem sessão do Firebase Authentication, manda
 * para `/entrar` antes de qualquer tela interna aparecer.
 */
export default function LayoutApp({ children }: { children: ReactNode }) {
  return (
    <ExigeLogin>
      <div className="flex h-full">
        <MenuLateral />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </ExigeLogin>
  );
}

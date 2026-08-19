import { TelaUsuarios } from './TelaUsuarios';

/**
 * Gerenciar Usuários — quem tem login no Coredja, com que papéis e quais
 * áreas de recado cada um enxerga. Só aparece no menu para quem tem
 * `pessoas:escrever` (papel admin) — ver `MenuLateral.tsx`.
 */
export default function PaginaUsuarios() {
  return <TelaUsuarios />;
}

import { TelaDepartamentos } from './TelaDepartamentos';

/**
 * Gerenciar Departamentos — os setores da igreja que conversam entre si.
 * Só aparece no menu para quem tem `departamentos:escrever` (papel admin) —
 * ver `MenuLateral.tsx`.
 */
export default function PaginaDepartamentos() {
  return <TelaDepartamentos />;
}

import { TelaCulto } from './TelaCulto';

/**
 * Ordem do Culto.
 *
 * Uma tela só, que se comporta diferente por papel: líder e operador montam
 * e reordenam; qualquer pessoa logada só acompanha o que está "agora". A
 * separação de modo acontece dentro de `TelaCulto`, não em rotas diferentes —
 * ver a nota lá sobre por que isso simplifica em vez de complicar.
 */
export default function PaginaCulto() {
  return <TelaCulto />;
}

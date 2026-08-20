import { TelaConfiguracoes } from './TelaConfiguracoes';

/**
 * Configurações da instalação — Holyrics, banco, e o que falta ajustar.
 * Só aparece no menu para quem tem `departamentos:escrever` (papel admin), e
 * a rota também responde 403 a qualquer outro papel — ver
 * `src/app/api/configuracoes/route.ts`.
 */
export default function PaginaConfiguracoes() {
  return <TelaConfiguracoes />;
}

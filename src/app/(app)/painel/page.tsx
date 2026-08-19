import { montarConversas } from '@/lib/conversas';
import { PainelAudiovisual } from './PainelAudiovisual';

/**
 * Painel do audiovisual.
 *
 * Fica aberto no monitor lateral durante o culto. Uma conversa por área, com
 * os recados chegando em tempo real.
 */

export const dynamic = 'force-dynamic';

export default async function PaginaPainel() {
  return <PainelAudiovisual conversasIniciais={await montarConversas()} />;
}

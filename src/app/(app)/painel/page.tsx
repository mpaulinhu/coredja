import { PainelAudiovisual } from './PainelAudiovisual';

/**
 * Painel de conversas entre departamentos.
 *
 * Fica aberto no monitor lateral durante o culto, com os recados chegando em
 * tempo real.
 *
 * Não monta conversa nenhuma no servidor: este componente não tem acesso à
 * sessão (o login é conferido no cliente, via Firebase Authentication — ver
 * `ExigeLogin.tsx` — e o token Bearer só chega nas rotas de API). Montar aqui
 * exigiria um "admin sintético" sem filtro, o que colocaria as conversas de
 * TODOS os departamentos no HTML inicial de qualquer pessoa logada. O client
 * busca em `/api/painel/mensagens`, que sabe quem está pedindo.
 */

export const dynamic = 'force-dynamic';

export default function PaginaPainel() {
  return <PainelAudiovisual />;
}

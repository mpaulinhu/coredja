import { store } from '@/lib/store';
import { PainelAudiovisual } from './PainelAudiovisual';

/**
 * Painel do audiovisual.
 *
 * Fica aberto no monitor lateral durante o culto. Recebe os recados das áreas
 * em tempo real, com os urgentes no topo.
 */

export const dynamic = 'force-dynamic';

export default async function PaginaPainel() {
  const [areas, pendentes, historico] = await Promise.all([
    store.listarAreas(),
    store.listarPendentes(),
    store.listarHistorico(50),
  ]);

  return (
    <PainelAudiovisual
      areasIniciais={areas}
      pendentesIniciais={pendentes}
      historicoInicial={historico}
    />
  );
}

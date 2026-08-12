import { notFound } from 'next/navigation';
import { separarChaveDeAcesso } from '@/lib/areas';
import { store } from '@/lib/store';
import { TelaDaArea } from './TelaDaArea';

/**
 * Página de uma área (Cantina, Kids).
 *
 * O acesso é pelo link secreto `/a/{slug}-{token}`, salvo na tela inicial do
 * celular de cada área. A validação da chave acontece aqui, no servidor, antes
 * de qualquer coisa aparecer na tela.
 */

export const dynamic = 'force-dynamic';

export default async function PaginaDaArea({
  params,
}: {
  params: Promise<{ chave: string }>;
}) {
  const { chave } = await params;

  const partes = separarChaveDeAcesso(chave);
  if (!partes) notFound();

  const area = await store.autenticarArea(partes.slug, partes.token);
  if (!area) notFound();

  const mensagens = await store.listarPorArea(area.slug);

  return <TelaDaArea area={area} chave={chave} mensagensIniciais={mensagens} />;
}

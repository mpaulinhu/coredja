import Link from 'next/link';
import { ARMAZENAMENTO_ATIVO } from '@/lib/store';

/**
 * Página inicial.
 *
 * Porta de entrada: quem já tem conta entra, quem não tem descobre que
 * precisa de uma.
 *
 * Até aqui esta página listava também o LINK SECRETO de cada área (Cantina,
 * Kids) — um endereço com token que dava direito de mandar recado sem login
 * nenhum. Isso fazia sentido enquanto o Coredja só existia dentro do Wi-Fi da
 * igreja: para alcançar o link era preciso estar lá dentro.
 *
 * Publicado na internet, a mesma página entregaria a qualquer visitante o
 * acesso de escrita de todas as áreas — e a home é a primeira coisa que
 * qualquer pessoa abre. Os links saíram, e cada pessoa da Cantina e do Kids
 * passa a ter conta com login, como todo mundo (ver `papeis.ts`).
 */
export default function Home() {
  const naNuvem = ARMAZENAMENTO_ATIVO === 'firebase';

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-texto">Coredja</h1>
      <p className="mt-1 text-texto-suave">Comunicação interna da igreja</p>

      {/* Deixa visível onde os recados estão sendo guardados, para não ser
          preciso abrir arquivo de configuração para descobrir. */}
      <p
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-borda bg-fundo-cartao px-3 py-1.5 text-xs"
        title={
          naNuvem
            ? 'Os recados são salvos no Cloud Firestore.'
            : 'Os recados são salvos em dados/, neste PC.'
        }
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: naNuvem ? 'var(--sucesso)' : 'var(--acento)' }}
          aria-hidden="true"
        />
        <span className="text-texto-suave">
          {naNuvem ? 'Recados na nuvem (Firebase)' : 'Recados neste PC (local)'}
        </span>
      </p>

      <section className="mt-8">
        <Link
          href="/painel"
          className="flex items-center justify-between rounded-xl border border-borda bg-fundo-cartao px-4 py-4 hover:bg-borda"
        >
          <span className="font-semibold text-texto">Entrar no Coredja</span>
          <span className="text-texto-fraco">→</span>
        </Link>
        <p className="mt-3 text-sm text-texto-fraco">
          Cada pessoa entra com o próprio e-mail e senha. Quem ainda não tem
          conta precisa pedir a quem administra o Coredja — é ele quem cria o
          acesso e escolhe com quais setores você conversa.
        </p>
      </section>
    </div>
  );
}

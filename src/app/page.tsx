import Link from 'next/link';
import { AREAS, caminhoDaArea } from '@/lib/areas';
import { ARMAZENAMENTO_ATIVO } from '@/lib/store';

/**
 * Página inicial.
 *
 * Serve de índice: o painel do audiovisual e o link de cada área, para
 * abrir no celular e salvar na tela inicial.
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
            ? 'Os recados são salvos no Cloud Firestore. As imagens continuam no disco deste PC.'
            : 'Os recados e as imagens são salvos em dados/, neste PC.'
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-fraco">
          Audiovisual
        </h2>
        <Link
          href="/painel"
          className="mt-2 flex items-center justify-between rounded-xl border border-borda bg-fundo-cartao px-4 py-4 hover:bg-borda"
        >
          <span className="font-semibold text-texto">Abrir painel</span>
          <span className="text-texto-fraco">→</span>
        </Link>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-fraco">
          Áreas
        </h2>
        <p className="mt-1 text-sm text-texto-fraco">
          Abra o link no celular da área e salve na tela inicial.
        </p>

        <ul className="mt-3 flex flex-col gap-2">
          {AREAS.map((area) => (
            <li key={area.slug}>
              <Link
                href={caminhoDaArea(area)}
                className="flex items-center gap-3 rounded-xl border border-borda bg-fundo-cartao px-4 py-4 hover:bg-borda"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: area.cor }}
                  aria-hidden="true"
                />
                <span className="font-semibold text-texto">{area.nome}</span>
                <code className="ml-auto text-xs text-texto-fraco">
                  {caminhoDaArea(area)}
                </code>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

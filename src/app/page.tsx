import Link from 'next/link';
import { AREAS, caminhoDaArea } from '@/lib/areas';

/**
 * Página inicial.
 *
 * Serve de índice: o painel do audiovisual e o link de cada área, para
 * abrir no celular e salvar na tela inicial.
 */
export default function Home() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-texto">Coredja</h1>
      <p className="mt-1 text-texto-suave">Comunicação interna da igreja</p>

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

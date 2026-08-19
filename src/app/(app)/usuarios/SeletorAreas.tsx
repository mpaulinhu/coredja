'use client';

import type { AreaResumo } from './TelaUsuarios';

interface Props {
  areas: AreaResumo[];
  selecionadas: string[];
  onMudar: (slugs: string[]) => void;
}

/** Chips clicáveis para escolher quais áreas a pessoa enxerga no Painel. */
export function SeletorAreas({ areas, selecionadas, onMudar }: Props) {
  function alternar(slug: string) {
    onMudar(
      selecionadas.includes(slug)
        ? selecionadas.filter((s) => s !== slug)
        : [...selecionadas, slug],
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {areas.map((area) => {
        const ativa = selecionadas.includes(area.slug);
        return (
          <button
            key={area.slug}
            type="button"
            onClick={() => alternar(area.slug)}
            aria-pressed={ativa}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
            style={
              ativa
                ? { background: 'var(--fundo-cartao)', borderColor: area.cor, color: 'var(--texto)' }
                : { background: 'transparent', borderColor: 'var(--borda)', color: 'var(--texto-suave)' }
            }
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: area.cor }}
              aria-hidden="true"
            />
            {area.nome}
          </button>
        );
      })}
    </div>
  );
}

'use client';

interface Props {
  texto: string;
  onDispensar: () => void;
}

/**
 * Faixa de recado dispensável — o que aconteceu depois de uma ação que já foi
 * feita, mas teve algum detalhe a contar (o cronômetro não chegou ao Holyrics,
 * a arte ficou de fora do telão).
 *
 * `role="status"` e não `role="alert"`: nada aqui é falha da ação principal,
 * que já está gravada. O leitor de tela anuncia sem interromper.
 */
export function Recado({ texto, onDispensar }: Props) {
  return (
    <div
      role="status"
      className="mx-auto mt-3 max-w-3xl rounded-xl border px-4 py-3 text-sm"
      style={{
        borderColor: 'var(--urgente)',
        background: 'var(--urgente-fundo)',
        color: 'var(--texto)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0">{texto}</p>
        <button
          type="button"
          onClick={onDispensar}
          aria-label="Dispensar recado"
          className="shrink-0 text-texto-fraco hover:text-texto"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

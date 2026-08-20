'use client';

/**
 * Escolha da cor de um departamento.
 *
 * A cor aparece como bolinha ao lado do nome em todo o produto (seletor de
 * departamento, lista de conversas do painel), então o que importa é ela ser
 * distinguível das outras — não ser exata. As sugestões cobrem o círculo
 * cromático em passos largos e resolvem o caso comum com um toque; o
 * `<input type="color">` fica ao lado para quem quiser outra qualquer.
 */

const SUGESTOES = [
  '#e4814e',
  '#e4574e',
  '#d75a9c',
  '#8b5cf6',
  '#6366f1',
  '#3f8fe0',
  '#2bb3a3',
  '#4caf7d',
  '#b0863c',
  '#7d7367',
];

interface Props {
  valor: string;
  onMudar: (cor: string) => void;
  /** Prefixo do id, para os rótulos apontarem certo quando há dois seletores na tela. */
  idPrefixo: string;
}

export function SeletorCor({ valor, onMudar, idPrefixo }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SUGESTOES.map((cor) => {
        const ativo = cor.toLowerCase() === valor.toLowerCase();
        return (
          <button
            key={cor}
            type="button"
            onClick={() => onMudar(cor)}
            aria-label={`Usar a cor ${cor}`}
            aria-pressed={ativo}
            className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              background: cor,
              borderColor: ativo ? 'var(--texto)' : 'transparent',
            }}
          />
        );
      })}

      <label
        htmlFor={`${idPrefixo}-cor`}
        className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-borda px-2 text-xs text-texto-suave"
      >
        <input
          id={`${idPrefixo}-cor`}
          type="color"
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
          className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
        />
        Outra
      </label>
    </div>
  );
}

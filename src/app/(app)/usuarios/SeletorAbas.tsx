'use client';

import { ABAS, abasPadrao, type Papel } from '@/lib/papeis';

interface Props {
  /** O cargo escolhido agora — decide quais abas podem aparecer. */
  papel: Papel;
  /** `null` = seguindo o padrão do cargo; lista = escolha própria. */
  selecionadas: string[] | null;
  onMudar: (abas: string[] | null) => void;
}

/**
 * Escolhe quais telas aparecem no menu da pessoa.
 *
 * Começa em "padrão do cargo" e só vira escolha própria quando alguém mexe.
 * A diferença importa: uma pessoa no padrão acompanha mudanças futuras (se
 * um dia o Operador passar a ver outra tela, ela ganha também), enquanto uma
 * com lista própria fica com o que foi marcado, e alguém precisa lembrar de
 * revisar.
 *
 * Só mostra o que o CARGO alcança: marcar "Usuários" para um operador daria
 * um item de menu que leva a um 403 — o servidor confere o papel de qualquer
 * forma (ver `abasDaPessoa`). Por isso trocar o cargo redesenha a lista.
 */
export function SeletorAbas({ papel, selecionadas, onMudar }: Props) {
  const disponiveis = abasPadrao(papel);
  const abas = ABAS.filter((aba) => disponiveis.includes(aba.id));
  const noPadrao = selecionadas === null;
  const marcadas = selecionadas ?? disponiveis;

  if (abas.length === 0) return null;

  function alternar(id: string) {
    const proximas = marcadas.includes(id)
      ? marcadas.filter((a) => a !== id)
      : [...marcadas, id];
    onMudar(proximas);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {abas.map((aba) => {
          const ativa = marcadas.includes(aba.id);
          return (
            <button
              key={aba.id}
              type="button"
              onClick={() => alternar(aba.id)}
              aria-pressed={ativa}
              className="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
              style={
                ativa
                  ? {
                      background: 'var(--acento-suave-fundo)',
                      borderColor: 'var(--acento-suave-borda)',
                      color: 'var(--acento-texto-sobre-fundo)',
                    }
                  : {
                      background: 'transparent',
                      borderColor: 'var(--borda)',
                      color: 'var(--texto-suave)',
                    }
              }
            >
              {aba.rotulo}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-texto-fraco">
        {noPadrao ? (
          <>Seguindo o padrão do cargo — acompanha mudanças futuras.</>
        ) : (
          <>
            Escolha própria.{' '}
            <button
              type="button"
              onClick={() => onMudar(null)}
              className="font-semibold underline underline-offset-2 hover:text-texto"
            >
              Voltar ao padrão do cargo
            </button>
          </>
        )}
      </p>
    </div>
  );
}

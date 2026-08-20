'use client';

import { useEffect, useState } from 'react';
import {
  BotaoDiscreto,
  BotaoPrincipal,
  Cartao,
  Numero,
  Rotulo,
} from '@/components/Interface';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import {
  minutosDoBloco,
  responsavelDoBloco,
  totalDeMinutos,
  type Bloco,
  type ModeloCulto,
} from '@/lib/culto';

interface Props {
  /** Começa uma ordem nova a partir dos blocos deste modelo. */
  onUsar: (blocos: Bloco[]) => void;
  onVoltar: () => void;
}

/**
 * A biblioteca de modelos de ordem, como tela própria.
 *
 * Os modelos já existiam — mas escondidos atrás de um "Começar de um modelo"
 * dentro do editor, e só ao criar uma ordem nova. A tela de referência os
 * promove a botão fixo no topo ("Modelos"), então eles ganharam lugar
 * próprio: dá para conferir e apagar um modelo sem estar no meio da montagem
 * de um culto.
 *
 * "Salvar como modelo" continua no editor, e é o lugar certo: só faz sentido
 * salvar como modelo a sequência que está montada na tela.
 */
export function BibliotecaModelos({ onUsar, onVoltar }: Props) {
  const [modelos, setModelos] = useState<ModeloCulto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho || !vivo) return;
      const resp = await fetch('/api/culto/modelos', { headers: cabecalho });
      if (!vivo) return;
      if (!resp.ok) {
        setErro('Não foi possível carregar os modelos.');
        return;
      }
      const corpo = (await resp.json()) as { modelos?: ModeloCulto[] };
      if (vivo) setModelos(corpo.modelos ?? []);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function remover(id: string) {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return;
    await fetch(`/api/culto/modelos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: cabecalho,
    });
    setModelos((atuais) => atuais?.filter((m) => m.id !== id) ?? null);
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-10">
      <button
        type="button"
        onClick={onVoltar}
        className="cursor-pointer text-sm text-texto-suave hover:text-texto"
      >
        ← Todas as ordens
      </button>

      <header className="mt-3">
        <Rotulo>Biblioteca</Rotulo>
        <h1 className="mt-2 text-3xl leading-[1.05] font-extrabold tracking-[-0.03em] text-texto sm:text-[40px]">
          Modelos
        </h1>
        <p className="mt-2 max-w-xl text-sm text-texto-suave">
          Sequências salvas para não remontar o culto do zero toda semana. Use
          uma como ponto de partida — a ordem nova nasce com os blocos dela e
          fica livre para ajustar.
        </p>
      </header>

      {erro && (
        <p role="alert" className="mt-6 text-sm" style={{ color: 'var(--urgente)' }}>
          {erro}
        </p>
      )}

      {modelos === null && !erro && (
        <p className="mt-6 text-sm text-texto-fraco">Carregando modelos…</p>
      )}

      {modelos !== null && modelos.length === 0 && (
        <p className="mt-6 max-w-xl text-sm text-texto-suave">
          Nenhum modelo salvo ainda. Monte uma ordem e use &quot;Salvar como
          modelo&quot; no rodapé do editor para criar o primeiro.
        </p>
      )}

      {modelos !== null && modelos.length > 0 && (
        <ul className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
          {modelos.map((modelo) => (
            <li key={modelo.id}>
              <Cartao className="flex h-full flex-col gap-4 p-5 sm:p-6">
                <div>
                  <p className="text-lg font-bold break-words text-texto">
                    {modelo.nome}
                  </p>
                  <Numero className="mt-1.5 block text-sm text-texto-suave">
                    {modelo.blocos.length}{' '}
                    {modelo.blocos.length === 1 ? 'bloco' : 'blocos'} ·{' '}
                    {totalDeMinutos(modelo.blocos)} min
                  </Numero>
                </div>

                <ul className="flex flex-col gap-1.5">
                  {modelo.blocos.map((bloco, i) => {
                    const responsavel = responsavelDoBloco(bloco);
                    return (
                      <li
                        key={bloco.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 truncate text-texto-suave">
                          <Numero className="mr-2 text-xs text-texto-fraco">
                            {i + 1}
                          </Numero>
                          {bloco.titulo || 'Sem título'}
                          {responsavel && (
                            <span className="text-texto-fraco"> · {responsavel}</span>
                          )}
                        </span>
                        <Numero className="shrink-0 text-xs text-texto-fraco">
                          {minutosDoBloco(bloco)} min
                        </Numero>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-auto flex flex-wrap gap-2.5">
                  <BotaoPrincipal
                    onClick={() =>
                      // Ids novos: o modelo é um MOLDE, e reaproveitar os ids
                      // dele faria duas ordens diferentes apontarem para os
                      // mesmos blocos — o `blocoAtualId` de uma casaria com a
                      // outra.
                      onUsar(modelo.blocos.map((b) => ({ ...b, id: crypto.randomUUID() })))
                    }
                    className="flex-1 text-sm"
                  >
                    Usar este modelo
                  </BotaoPrincipal>
                  <BotaoDiscreto
                    onClick={() => void remover(modelo.id)}
                    aria-label={`Apagar o modelo ${modelo.nome}`}
                  >
                    Apagar
                  </BotaoDiscreto>
                </div>
              </Cartao>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

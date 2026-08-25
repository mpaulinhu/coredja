'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';

interface LinhaDoLog {
  id: string;
  linha: string;
  criadoEm: string;
}

/** De quanto em quanto tempo a tela pergunta por linhas novas. */
const INTERVALO_MS = 4_000;

/**
 * O `registro.txt` do Conector, sem precisar estar no PC do audiovisual.
 *
 * A ponte roda sem janela nenhuma (ver o gotcha sobre `runminimized` no
 * README dela) e o arquivo fica só naquele computador — até aqui, diagnosticar
 * "o telão não respondeu no domingo" exigia alguém fisicamente lá, abrindo o
 * arquivo. Esta tela busca o mesmo conteúdo pela rede.
 *
 * Não é um `onSnapshot` do Firestore: `telao_estado` é fechada dos dois lados
 * nas regras de propósito (só o servidor e a ponte, com credencial de
 * administrador, tocam nela — ver `firestore.rules`), então o navegador
 * pergunta ao SERVIDOR do Coredja, que lê com o Admin SDK. Polling em vez de
 * tempo real de verdade, mas suficiente para acompanhar o que está
 * acontecendo agora — o volume é de poucas linhas por culto, não um fluxo
 * contínuo que justificasse a complexidade de um listener.
 */
export function CartaoRegistroDaPonte() {
  const [linhas, setLinhas] = useState<LinhaDoLog[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const buscar = useCallback(async () => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return;

    const resp = await fetch('/api/telao/log', { headers: cabecalho });
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setErro(corpo.erro ?? 'Não foi possível carregar o registro.');
      return;
    }
    setErro(null);
    setLinhas(corpo.linhas as LinhaDoLog[]);
  }, []);

  useEffect(() => {
    // O `await` dentro da IIFE não é decorativo — mesmo motivo de
    // `TelaConfiguracoes`: sem ele o lint lê a chamada como `setState`
    // síncrono dentro do efeito.
    (async () => {
      await buscar();
    })();
    const id = setInterval(() => void buscar(), INTERVALO_MS);
    return () => clearInterval(id);
  }, [buscar]);

  // A subcoleção vem mais nova primeiro (ver `ultimasLinhasDoLogDaPonte`);
  // aqui se lê de cima para baixo como um terminal normal, então inverte.
  const emOrdem = linhas ? [...linhas].reverse() : null;

  return (
    <section className="rounded-2xl border border-borda bg-fundo-elevado p-5 sm:p-6">
      <div>
        <h2 className="text-base font-bold text-texto">Registro da ponte</h2>
        <p className="mt-0.5 text-xs text-texto-fraco">
          O que o Conector do Telão fez, direto do PC do audiovisual — o mesmo
          conteúdo do arquivo <code className="font-mono">registro.txt</code>{' '}
          de lá, sem precisar abrir nada nesse computador.
        </p>
      </div>

      <div
        ref={containerRef}
        className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-borda bg-fundo px-3 py-2.5 font-mono text-[13px] leading-relaxed"
      >
        {erro && (
          <p role="alert" className="text-texto-fraco">
            {erro}
          </p>
        )}
        {!erro && emOrdem === null && (
          <p className="text-texto-fraco">Carregando…</p>
        )}
        {!erro && emOrdem !== null && emOrdem.length === 0 && (
          <p className="text-texto-fraco">
            Nenhum registro ainda — a ponte precisa ter rodado pelo menos uma
            vez com esta versão para aparecer aqui.
          </p>
        )}
        {!erro &&
          emOrdem?.map((item) => (
            <p key={item.id} className="whitespace-pre-wrap text-texto-suave">
              {item.linha}
            </p>
          ))}
      </div>
    </section>
  );
}

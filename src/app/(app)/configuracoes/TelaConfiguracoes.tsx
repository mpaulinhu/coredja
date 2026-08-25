'use client';

import { useCallback, useEffect, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';
import { CabecalhoDaTela } from '@/components/CabecalhoDaTela';
import type {
  ConfiguracoesParaTela,
  ResultadoDoTeste,
} from '@/lib/configuracoes-compartilhado';
import { CartaoFirebase } from './CartaoFirebase';
import { CartaoHolyrics } from './CartaoHolyrics';
import { CartaoRegistroDaPonte } from './CartaoRegistroDaPonte';
import { Checklist } from './Checklist';

/**
 * Configurações: o que esta instalação do Coredja precisa saber para
 * funcionar, num lugar só.
 *
 * Existe para o momento de levar o Coredja para outro servidor ou outra
 * igreja: em vez de caçar variável em arquivo, abre-se esta tela, vê-se o que
 * está pendente e troca-se o que dá para trocar daqui.
 *
 * Diferente das outras telas, aqui NÃO há `podeEditar` vindo na resposta: a
 * rota responde 403 para quem não é admin, tanto no GET quanto no PUT, então
 * quem não pode nem chega a ver os dados. Um `podeEditar` só faria sentido se
 * houvesse um modo leitura — e não há, porque a tela inteira é informação de
 * administração.
 */
export function TelaConfiguracoes() {
  const [dados, setDados] = useState<ConfiguracoesParaTela | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) {
      setErro('Sessão expirada. Recarregue a página.');
      return;
    }
    const resp = await fetch('/api/configuracoes', { headers: cabecalho });
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      setErro(corpo.erro ?? 'Não foi possível carregar as configurações.');
      return;
    }
    setErro(null);
    setDados(corpo as ConfiguracoesParaTela);
  }, []);

  useEffect(() => {
    // O `await` dentro da IIFE não é decorativo — mesmo motivo de
    // `TelaAoVivo`: sem ele o lint lê a chamada como `setState` síncrono.
    (async () => {
      await carregar();
    })();
  }, [carregar]);

  const salvar = useCallback(
    async (mudancas: {
      holyricsUrl?: string;
      holyricsToken?: string;
      holyricsPastaFotos?: string;
    }) => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return 'Sessão expirada. Recarregue a página.';

      const resp = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify(mudancas),
      });
      const corpo = await resp.json().catch(() => ({}));
      if (!resp.ok) return corpo.erro ?? 'Não foi possível salvar.';

      // Recarrega para a tela refletir o que de fato ficou gravado: a origem
      // do valor muda de "vindo do .env.local" para "salvo nesta tela", o
      // checklist encolhe, e a máscara do token passa a mostrar os 4 últimos
      // caracteres do novo.
      await carregar();
      return null;
    },
    [carregar],
  );

  const testar = useCallback(async (): Promise<ResultadoDoTeste | null> => {
    const cabecalho = await cabecalhoDeAutorizacao();
    if (!cabecalho) return null;

    const resp = await fetch('/api/configuracoes/testar', {
      method: 'POST',
      headers: cabecalho,
    });
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        estado: 'recusado',
        motivo: corpo.erro ?? 'Não foi possível testar agora.',
      };
    }
    return corpo as ResultadoDoTeste;
  }, []);

  if (erro && !dados) {
    return (
      <div className="w-full px-5 py-8 sm:px-8">
        <CabecalhoDaTela titulo="Configurações" />
        <p
          role="alert"
          className="mx-auto mt-4 max-w-xl text-center text-sm"
          style={{ color: 'var(--urgente)' }}
        >
          {erro}
        </p>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="flex h-full items-center justify-center px-5">
        <p className="text-sm text-texto-fraco">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="w-full px-5 py-8 sm:px-8">
      <CabecalhoDaTela
        titulo="Configurações"
        instrucao="O que esta instalação precisa para funcionar. Ao levar o Coredja para outro servidor, é por aqui que se troca o que muda de lugar para lugar."
      />

      <div className="mx-auto mt-6 flex max-w-5xl flex-col gap-5">
        <Checklist pendencias={dados.pendencias} />

        {/* A `key` amarrada aos valores do servidor é o que mantém os campos
            do cartão em dia sem um efeito copiando props para estado: salvou,
            o servidor devolveu outro valor, a key muda, o React remonta o
            cartão e os `useState` renascem já com o valor gravado. */}
        <CartaoHolyrics
          key={`${dados.holyrics.url.valor}|${dados.holyrics.token.valor}`}
          holyrics={dados.holyrics}
          ultimaAlteracao={dados.ultimaAlteracao}
          onSalvar={salvar}
          onTestar={testar}
        />

        <CartaoFirebase firebase={dados.firebase} />

        <CartaoRegistroDaPonte />

        {/* Erro que aparece DEPOIS de a tela já ter carregado — ex: o
            recarregamento pós-salvamento falhou. Fica no fim para não
            empurrar o conteúdo. */}
        {erro && (
          <p role="alert" className="text-sm" style={{ color: 'var(--urgente)' }}>
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}

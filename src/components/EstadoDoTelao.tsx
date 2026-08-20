'use client';

import { useEffect, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';

/**
 * Como está o telão, para as telas que têm botão de projetar.
 *
 * Existe para o problema não ser descoberto ao vivo. Até aqui, a única forma
 * de saber que o Holyrics estava fora do ar era clicar em "Projetar" e ler o
 * erro — no domingo, no meio do culto. Agora a tela pergunta ao abrir e marca
 * os botões que não vão surtir efeito.
 *
 * O hook e o selo moram juntos porque nunca se usa um sem o outro, e separá-los
 * em dois arquivos só espalharia o mesmo assunto.
 */

export type EstadoDoTelao = 'nao-configurado' | 'conectado' | 'desconectado';

interface Status {
  estado: EstadoDoTelao;
  /** Se alguém preencheu endereço e token — ver a rota `/api/holyrics/status`. */
  configurado: boolean;
  motivoImagem: string;
  /** Enquanto a primeira resposta não chega, para a tela não piscar um aviso. */
  carregando: boolean;
}

const INICIAL: Status = {
  estado: 'nao-configurado',
  configurado: false,
  motivoImagem: '',
  carregando: true,
};

/**
 * Pergunta ao servidor como está o telão.
 *
 * Substitui o `useEffect` que a tela de Avisos tinha copiado: agora que a
 * Ordem do Culto precisa da mesma informação, duplicar a busca deixaria as
 * duas telas livres para divergir em detalhes (tratamento de erro, o que
 * fazer enquanto carrega) sem que ninguém percebesse.
 */
export function useEstadoDoTelao(): Status {
  const [status, setStatus] = useState<Status>(INICIAL);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho || !vivo) return;

      const resp = await fetch('/api/holyrics/status', { headers: cabecalho });
      if (!resp.ok || !vivo) return;

      const dados = (await resp.json()) as {
        configurado?: boolean;
        estado?: EstadoDoTelao;
        motivoImagem?: string;
      };
      if (!vivo) return;

      setStatus({
        estado: dados.estado ?? 'nao-configurado',
        configurado: dados.configurado === true,
        motivoImagem: dados.motivoImagem ?? '',
        carregando: false,
      });
    })().catch(() => {
      // A integração é opcional: não saber como está o telão não pode
      // quebrar a tela nem impedir de operar o culto à mão.
      if (vivo) setStatus((s) => ({ ...s, carregando: false }));
    });

    return () => {
      vivo = false;
    };
  }, []);

  return status;
}

/**
 * O selo ao lado dos botões que dependem do telão.
 *
 * Só aparece quando há o que dizer:
 *
 * - `nao-configurado` → nada. Quem nunca ligou a integração não deve receber
 *   recado sobre ela; para essa pessoa projetar à mão é simplesmente como o
 *   sistema funciona, e um alerta permanente viraria ruído que se aprende a
 *   ignorar (e junto com ele, o alerta que importa).
 * - `conectado` → nada, pelo mesmo motivo. Confirmar o que já se espera não
 *   acrescenta informação; o estado normal deve ser silencioso.
 * - `desconectado` → aparece. É a única combinação em que a pessoa vai clicar
 *   esperando uma coisa e receber outra.
 */
export function SeloDoTelao({
  estado,
  carregando,
}: {
  estado: EstadoDoTelao;
  carregando: boolean;
}) {
  if (carregando || estado !== 'desconectado') return null;

  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
      style={{ color: 'var(--alerta)', background: 'var(--alerta-fundo)' }}
      title="O Coredja não está conseguindo falar com o Holyrics. Confira se o computador do audiovisual está ligado e com o Holyrics aberto — ou projete pelo próprio Holyrics."
    >
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ background: 'var(--alerta)' }}
      />
      Telão desconectado — projete à mão
    </span>
  );
}

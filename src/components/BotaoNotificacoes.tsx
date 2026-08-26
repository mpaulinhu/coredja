'use client';

import { useCallback, useEffect, useState } from 'react';
import { cabecalhoDeAutorizacao } from '@/lib/auth-cliente';

/**
 * Liga e desliga a notificação no celular deste aparelho.
 *
 * A inscrição é POR APARELHO, não por pessoa: quem usa o celular e o
 * computador precisa ativar nos dois, e desativar num não mexe no outro. É
 * como funciona em qualquer aplicativo de mensagem.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O CASO DO iPHONE
 * ────────────────────────────────────────────────────────────────────────────
 * O Safari só oferece push quando o site foi adicionado à Tela de Início.
 * Antes disso `PushManager` nem existe, e o botão não teria o que fazer —
 * por isso a tela explica o passo em vez de mostrar um botão que falha.
 * `navigator.standalone` é a forma (só do Safari) de saber se estamos
 * rodando a partir do ícone.
 */

type Estado =
  | 'carregando'
  /** Este navegador não faz push de jeito nenhum. */
  | 'sem-suporte'
  /** iPhone no Safari, ainda sem adicionar à Tela de Início. */
  | 'precisa-instalar'
  | 'desligado'
  | 'ligado'
  /** A pessoa recusou no navegador — só ela pode desfazer, nas configurações. */
  | 'bloqueado';

/**
 * A chave pública precisa virar bytes para o `subscribe`.
 *
 * O `ArrayBuffer` explícito não é decorativo: `Uint8Array.from` devolve
 * `Uint8Array<ArrayBufferLike>`, que o TypeScript não aceita onde se espera
 * `BufferSource` — `ArrayBufferLike` inclui `SharedArrayBuffer`, que não
 * serve aqui.
 */
function base64ParaBytes(base64: string): ArrayBuffer {
  const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const normal = preenchido.replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(normal);
  const buffer = new ArrayBuffer(bruto.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return buffer;
}

export function BotaoNotificacoes() {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      const temSuporte =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

      if (!temSuporte) {
        // No iPhone fora da Tela de Início o PushManager não existe — mas o
        // problema tem conserto, e dizer "sem suporte" mandaria a pessoa
        // desistir de algo que ela consegue.
        const ehIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const naTelaDeInicio =
          (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
        setEstado(ehIos && !naTelaDeInicio ? 'precisa-instalar' : 'sem-suporte');
        return;
      }

      if (Notification.permission === 'denied') {
        setEstado('bloqueado');
        return;
      }

      const registro = await navigator.serviceWorker.getRegistration();
      const inscricao = await registro?.pushManager.getSubscription();
      setEstado(inscricao ? 'ligado' : 'desligado');
    })().catch(() => setEstado('sem-suporte'));
  }, []);


  const ligar = useCallback(async () => {
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setEstado(permissao === 'denied' ? 'bloqueado' : 'desligado');
        return;
      }

      const registro = await navigator.serviceWorker.register('/sw.js');
      // Sem esperar o `ready`, o `subscribe` pode acontecer antes de o
      // service worker estar de fato ativo e falhar sem motivo aparente.
      await navigator.serviceWorker.ready;

      const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!chave) {
        setEstado('sem-suporte');
        return;
      }

      const inscricao = await registro.pushManager.subscribe({
        // Obrigatório nos navegadores atuais: todo push precisa resultar
        // numa notificação visível — não dá para usar isto para rodar código
        // silencioso no aparelho de alguém.
        userVisibleOnly: true,
        applicationServerKey: base64ParaBytes(chave),
      });

      const cabecalho = await cabecalhoDeAutorizacao();
      if (!cabecalho) return;

      const resp = await fetch('/api/push/inscricao', {
        method: 'POST',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify(inscricao.toJSON()),
      });
      // Servidor sem as chaves configuradas: desfaz a inscrição local, senão
      // o aparelho fica achando que está ligado e nunca receberia nada.
      if (!resp.ok) {
        await inscricao.unsubscribe().catch(() => {});
        setEstado('desligado');
        return;
      }

      setEstado('ligado');
    } catch {
      setEstado('desligado');
    } finally {
      setOcupado(false);
    }
  }, []);

  /**
   * Pede a permissão sozinho, uma vez por aparelho.
   *
   * O navegador só deixa pedir uma vez: recusado, o botão não consegue mais
   * abrir o pedido — a pessoa teria que ir nas configurações. Por isso o
   * `perguntou` no `localStorage`: reabrir o Coredja não gasta a única
   * chance de novo, e quem já decidiu (dos dois jeitos) não é incomodado.
   *
   * Só dispara quando há o que ativar: estado `desligado` e permissão ainda
   * em `default`.
   */
  useEffect(() => {
    if (estado !== 'desligado') return;
    if (Notification.permission !== 'default') return;
    try {
      if (localStorage.getItem('coredja:push-perguntado') === 'sim') return;
      localStorage.setItem('coredja:push-perguntado', 'sim');
    } catch {
      // Navegador sem localStorage (aba anônima): perguntar mesmo assim é
      // melhor que nunca perguntar.
    }
    // Um respiro antes de perguntar: a caixa do navegador aparecendo no mesmo
    // instante em que a tela carrega parece pop-up e é recusada no reflexo.
    const id = setTimeout(() => void ligar(), 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const desligar = useCallback(async () => {
    setOcupado(true);
    try {
      const registro = await navigator.serviceWorker.getRegistration();
      const inscricao = await registro?.pushManager.getSubscription();
      if (inscricao) {
        const cabecalho = await cabecalhoDeAutorizacao();
        if (cabecalho) {
          await fetch('/api/push/inscricao', {
            method: 'DELETE',
            headers: { ...cabecalho, 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: inscricao.endpoint }),
          }).catch(() => {});
        }
        await inscricao.unsubscribe();
      }
      setEstado('desligado');
    } catch {
      // Falhou ao desinscrever: o estado real continua "ligado".
    } finally {
      setOcupado(false);
    }
  }, []);

  if (estado === 'carregando' || estado === 'sem-suporte') return null;

  if (estado === 'precisa-instalar') {
    return (
      <p className="text-[13px] leading-relaxed text-texto-fraco">
        <strong className="font-semibold text-texto-suave">
          Para receber aviso no iPhone:
        </strong>{' '}
        toque em Compartilhar (o quadrado com a seta) e depois em{' '}
        <strong className="font-semibold text-texto-suave">
          Adicionar à Tela de Início
        </strong>
        . Abra o Coredja por esse ícone e o botão de ativar aparece aqui. É
        exigência da Apple — no Android funciona direto pelo navegador.
      </p>
    );
  }

  if (estado === 'bloqueado') {
    return (
      <p className="text-[13px] leading-relaxed text-texto-fraco">
        As notificações estão bloqueadas para o Coredja neste aparelho. Para
        voltar a receber, libere nas configurações do navegador (no cadeado ao
        lado do endereço) — daqui não dá para reverter.
      </p>
    );
  }

  const ligado = estado === 'ligado';
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={ligado ? desligar : ligar}
        disabled={ocupado}
        className="h-11 self-start rounded-xl border px-4 text-sm font-semibold transition-colors disabled:opacity-50"
        style={
          ligado
            ? {
                borderColor: 'var(--acento-suave-borda)',
                background: 'var(--acento-suave-fundo)',
                color: 'var(--acento-texto-sobre-fundo)',
              }
            : {
                borderColor: 'var(--borda-forte)',
                background: 'var(--fundo-cartao)',
                color: 'var(--texto)',
              }
        }
      >
        {ocupado
          ? 'Um instante…'
          : ligado
            ? '🔔 Avisos ligados neste aparelho'
            : 'Receber aviso de recado novo'}
      </button>
      <p className="text-xs text-texto-fraco">
        {ligado
          ? 'Recado novo chega como notificação, mesmo com o Coredja fechado. Vale só neste aparelho.'
          : 'Chega no celular mesmo com o Coredja fechado, como uma mensagem. Precisa ativar em cada aparelho.'}
      </p>
    </div>
  );
}

/*
 * Service worker do Coredja — o que faz a notificação chegar no celular
 * mesmo com o site fechado.
 *
 * Roda fora da página, no próprio navegador: quando o servidor manda um
 * push, é este arquivo que acorda e mostra o aviso. Por isso ele vive em
 * `public/` (precisa ser servido da raiz, senão só valeria para as páginas
 * abaixo da pasta dele) e não importa nada do resto do código.
 *
 * NÃO faz cache de página. Um service worker que guarda HTML deixa o site
 * mostrando versão velha depois de cada deploy, e o custo disso — numa tela
 * usada ao vivo no domingo — é maior que o ganho de abrir offline.
 */

self.addEventListener('install', () => {
  // Assume o controle sem esperar a aba antiga fechar: sem isto, ativar as
  // notificações só valeria na próxima vez que a pessoa abrisse o site.
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    // Push sem corpo JSON: mostra o genérico em vez de engolir o aviso.
  }

  const titulo = dados.titulo || 'Coredja';
  const opcoes = {
    body: dados.corpo || 'Você tem um recado novo.',
    icon: '/icone-192.png',
    // Ícone PRÓPRIO, com fundo transparente — não serve o do app.
    //
    // O Android renderiza o `badge` como silhueta: descarta as cores e pinta
    // de branco tudo que for opaco. Com o ícone do app (um quadrado azul
    // cheio) o resultado era um bloco branco sólido na barra de status, sem
    // desenho — o mesmo ícone aparecia certo só ao expandir a notificação,
    // porque ali quem manda é o `icon`. Ver `scripts/gerar-badge.mjs`.
    badge: '/badge-96.png',
    // Vibração longa e repetida no urgente — o padrão do sistema é discreto
    // demais para um recado que precisa interromper alguém no meio do culto.
    vibrate: dados.urgente
      ? [300, 120, 300, 120, 300, 120, 400]
      : [200, 100, 200],
    // Recados da MESMA conversa se substituem em vez de empilhar cinco
    // avisos iguais — quem chega no aparelho quer saber que há recado ali,
    // não receber um alerta por mensagem.
    tag: dados.conversaId || 'coredja',
    renotify: true,
    data: {
      url: dados.url || '/painel',
      conversaId: dados.conversaId || '',
    },
    // Urgente exige toque para sumir; o normal some sozinho.
    requireInteraction: Boolean(dados.urgente),
    // ┌─ POR QUE "RESPONDER" E NÃO UM CAMPO DE TEXTO ────────────────────────┐
    // Responder digitando DENTRO da notificação, como no WhatsApp, é recurso
    // de aplicativo nativo — o Web Push não tem campo de entrada em nenhum
    // navegador. O que dá é levar direto ao lugar de responder, com o campo
    // já focado: um toque a mais, sem a navegação no meio.
    // └─────────────────────────────────────────────────────────────────────┘
    actions: [
      { action: 'responder', title: 'Responder' },
      { action: 'abrir', title: 'Ver recado' },
    ],
  };

  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();

  const info = evento.notification.data || {};
  // `?responder=<conversa>` faz o painel abrir aquela conversa e focar o
  // campo de escrita — ver `PainelAudiovisual`.
  const destino =
    evento.action === 'responder' && info.conversaId
      ? `/painel?responder=${encodeURIComponent(info.conversaId)}`
      : info.url || '/painel';

  // Reaproveita uma aba já aberta do Coredja em vez de abrir outra: quem
  // toca na notificação quer VER o recado, e uma segunda aba do mesmo site
  // é só confusão. `navigate` leva a aba existente ao destino certo — sem
  // isso, um "Responder" numa aba já aberta noutra conversa só daria foco,
  // deixando a pessoa na conversa errada.
  evento.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((abas) => {
        for (const aba of abas) {
          if (aba.url.includes('/painel')) {
            return ('navigate' in aba ? aba.navigate(destino) : Promise.resolve(aba))
              .then((alvo) => (alvo && 'focus' in alvo ? alvo.focus() : null))
              .catch(() => aba.focus());
          }
        }
        return self.clients.openWindow(destino);
      }),
  );
});

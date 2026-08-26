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
    badge: '/icone-192.png',
    // Vibração curta-longa-curta: dá para reconhecer no bolso sem olhar.
    vibrate: dados.urgente ? [200, 100, 200, 100, 200] : [150, 75, 150],
    // Recados da MESMA conversa se substituem em vez de empilhar cinco
    // avisos iguais — quem chega no aparelho quer saber que há recado ali,
    // não receber um alerta por mensagem.
    tag: dados.conversaId || 'coredja',
    renotify: true,
    data: { url: dados.url || '/painel' },
    // Urgente exige toque para sumir; o normal some sozinho.
    requireInteraction: Boolean(dados.urgente),
  };

  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || '/painel';

  // Reaproveita uma aba já aberta do Coredja em vez de abrir outra: quem
  // toca na notificação quer VER o recado, e uma segunda aba do mesmo site
  // é só confusão.
  evento.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((abas) => {
        for (const aba of abas) {
          if (aba.url.includes(destino) && 'focus' in aba) return aba.focus();
        }
        return self.clients.openWindow(destino);
      }),
  );
});

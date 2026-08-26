'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker assim que o app abre.
 *
 * Duas coisas dependem disto, e nenhuma delas é a notificação em si (essa o
 * `BotaoNotificacoes` já registrava por conta própria ao ativar):
 *
 * 1. **Instalar o Coredja como app.** O Chrome só oferece "Instalar app"
 *    quando encontra um manifest válido E um service worker ativo. Sem o
 *    registro na carga da página, o convite nunca aparecia — e instalar é o
 *    que faz o Android tratar as notificações como de um app de verdade, em
 *    vez de "coisa do navegador" que ele mata para poupar bateria.
 *
 * 2. **Notificação sobreviver ao primeiro acesso.** Registrado desde o
 *    início, o service worker já está ativo quando a permissão é concedida.
 *
 * Não faz cache de nada — ver o comentário no topo de `public/sw.js`.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Silencioso de propósito: falhar aqui não impede usar o Coredja, só
    // adia o convite de instalar. Um erro na tela por causa disso seria
    // ruído sobre algo que a pessoa nem pediu.
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}

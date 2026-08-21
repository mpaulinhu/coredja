import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Pacotes que o bundler NÃO deve empacotar — usa-os direto do
   * `node_modules` em tempo de execução.
   *
   * `better-sqlite3` PRECISA disto: tem um binário nativo (código C++
   * compilado para o sistema operacional), e empacotá-lo quebraria o build.
   *
   * `firebase-admin` NÃO está mais aqui — ver o gotcha abaixo. Ele é código
   * puro (sem binário nativo) e SÓ é importado por arquivos sem `'use
   * client'`, então deixá-lo fora da lista não vaza para o navegador: o
   * bundler já separa client/server pelo `'use client'`, essa lista é para
   * pacotes que quebrariam SE fossem empacotados, o que não é o caso aqui.
   */
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;

/**
 * ────────────────────────────────────────────────────────────────────────────
 * GOTCHA — `firebase-admin` em `serverExternalPackages` quebra o login em
 * produção com um erro que não aparece em nenhum lugar óbvio (ELO — 21/08/2026)
 * ────────────────────────────────────────────────────────────────────────────
 * TODA rota de API que dependesse, direta ou indiretamente, de
 * `firebase-admin/auth` (ou seja: qualquer rota autenticada) respondia
 * **500 com corpo vazio** em produção na Netlify — mas funcionava perfeito em
 * `pnpm dev` local. Nenhuma mensagem de erro chegava ao navegador nem ao
 * `try/catch` das rotas: a falha acontecia no CARREGAMENTO do módulo, antes
 * do código da rota rodar.
 *
 * Causa raiz, achada só investigando o log de runtime da função na Netlify
 * (não do build — o build passava limpo):
 *
 *   Failed to load external module firebase-admin.../auth:
 *   Error [ERR_REQUIRE_ESM]: require() of ES Module
 *   .../jose@6.2.8/dist/webapi/index.js from
 *   .../jwks-rsa@4.1.0/src/utils.js not supported.
 *
 * `firebase-admin/auth` usa `jwks-rsa`, que usa `jose` — e a v6 do `jose` só
 * existe em formato ESM puro. Enquanto `firebase-admin` está DENTRO do
 * bundle (comportamento padrão do Next), o bundler resolve essa mistura
 * ESM/CommonJS sozinho. Declarado como `serverExternalPackages`, o pacote
 * (e suas dependências transitivas) fica de FORA do bundle, carregado direto
 * via `require()` do Node em runtime — e é exatamente esse `require()` que
 * não sabe lidar com um `jose` só-ESM.
 *
 * Por que só aparecia na Netlify, nunca localmente: o `pnpm dev` roda sobre
 * Webpack/Node num jeito mais tolerante a esse tipo de mistura; o build de
 * produção da Netlify usa Turbopack, que é estrito aqui. O mesmo `next
 * build` local também reproduz — só o `dev` mascarava.
 *
 * A correção: tirar `firebase-admin` de `serverExternalPackages`. Ele NÃO
 * tem binário nativo (ao contrário do `better-sqlite3`, que fica), então não
 * há motivo técnico para mantê-lo fora do bundle — e mantê-lo fora era
 * exatamente o que expunha o bug do `jose`/`jwks-rsa`.
 *
 * Se um dia o `firebase-admin` precisar voltar para esta lista (ex: erro de
 * build pedindo isso), o problema do `jose` volta junto — resolver
 * primeiro trocando de versão do `firebase-admin`/`jwks-rsa`, ou com um
 * alias de bundler para uma build CJS do `jose`, antes de reintroduzir.
 */

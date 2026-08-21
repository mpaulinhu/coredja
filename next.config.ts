import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Pacotes que o bundler NÃO deve empacotar — usa-os direto do
   * `node_modules` em tempo de execução.
   *
   * `better-sqlite3` PRECISA disto: tem um binário nativo (código C++
   * compilado para o sistema operacional), e empacotá-lo quebraria o build.
   */
  serverExternalPackages: ['better-sqlite3'],

  /**
   * Pacotes que o bundler DEVE transpilar, mesmo vindo de `node_modules` —
   * ver o gotcha completo no fim deste arquivo. `jose` e `jwks-rsa` são
   * dependências TRANSITIVAS do `firebase-admin` (não estão no
   * `package.json` direto), mas o Next aceita listá-las aqui do mesmo jeito.
   */
  transpilePackages: ['jose', 'jwks-rsa'],
};

export default nextConfig;

/**
 * ────────────────────────────────────────────────────────────────────────────
 * GOTCHA — `firebase-admin` quebra o login em produção na Netlify com um erro
 * que não aparece em nenhum lugar óbvio (ELO — 21/08/2026)
 * ────────────────────────────────────────────────────────────────────────────
 * TODA rota de API que dependesse, direta ou indiretamente, de
 * `firebase-admin/auth` (ou seja: qualquer rota autenticada) respondia
 * **500 com corpo vazio** em produção na Netlify — mas funcionava perfeito em
 * `pnpm dev` local e em `next build` local. Nenhuma mensagem de erro chegava
 * ao navegador nem ao `try/catch` das rotas: a falha acontecia no
 * CARREGAMENTO do módulo, antes do código da rota rodar.
 *
 * Causa raiz, achada só investigando o log de RUNTIME da função na Netlify
 * (não do build — o build sempre passava limpo):
 *
 *   Failed to load external module firebase-admin.../auth:
 *   Error [ERR_REQUIRE_ESM]: require() of ES Module
 *   .../jose@6.2.8/dist/webapi/index.js from
 *   .../jwks-rsa@4.1.0/src/utils.js not supported.
 *
 * `firebase-admin/auth` usa `jwks-rsa`, que usa `jose` — e a v6 do `jose` só
 * existe em formato ESM puro. Node 20.19+/22.12+ sabe fazer `require()` de
 * ESM nativamente, e a Netlify roda Node 22 — mas essa capacidade não é
 * herdada automaticamente pelo jeito como o `@netlify/plugin-nextjs`
 * carrega pacotes marcados como "externos" (fora do bundle): ele os
 * `require()` num contexto que não tem esse suporte.
 *
 * PRIMEIRA TENTATIVA (insuficiente): tirar `firebase-admin` de
 * `serverExternalPackages`. Resolveu no `next build` local, mas o erro
 * PERSISTIU na Netlify — confirmado testando em produção depois do deploy.
 * O plugin da Netlify tem sua própria lógica de bundling por cima do Next e
 * continuava tratando `firebase-admin` (e suas dependências) como externo,
 * independente da configuração do `next.config.ts`.
 *
 * FIX que funcionou: `transpilePackages: ['jose', 'jwks-rsa']`. Isso força o
 * bundler a processar esses dois pacotes específicos (mesmo sendo
 * dependências TRANSITIVAS, não diretas do projeto) em vez de deixá-los
 * como `require()` cru — e é justamente esse `require()` cru que não sabe
 * carregar o `jose`, que é ESM puro.
 *
 * Por que só o `jose`/`jwks-rsa`, e não o `firebase-admin` inteiro: o
 * `firebase-admin` em si é CommonJS normal, sem problema de ESM — só a
 * cadeia de dependência dele (`auth` → `jwks-rsa` → `jose`) que carrega um
 * pacote ESM-only. Empurrar só essa cadeia para dentro do bundle resolve
 * sem reintroduzir o efeito colateral original de tirar o `firebase-admin`
 * inteiro de `serverExternalPackages` (que por sua vez não era necessário —
 * `firebase-admin` nunca precisou estar nessa lista).
 */

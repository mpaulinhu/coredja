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
};

export default nextConfig;

/**
 * ────────────────────────────────────────────────────────────────────────────
 * GOTCHA — `firebase-admin/auth` quebrava toda rota autenticada em produção
 * na Netlify (ERR_REQUIRE_ESM), causa raiz é `jose` v6, não bundler (21/08/2026)
 * ────────────────────────────────────────────────────────────────────────────
 * TODA rota de API que dependesse, direta ou indiretamente, de
 * `firebase-admin/auth` (ou seja: qualquer rota autenticada) respondia
 * **500 com corpo vazio** em produção — mas funcionava perfeito local
 * (`pnpm dev` e `next build`). O erro real, só visível no log de RUNTIME da
 * função (não do build):
 *
 *   Error [ERR_REQUIRE_ESM]: require() of ES Module
 *   .../jose@6.2.8/dist/webapi/index.js from
 *   .../jwks-rsa@4.1.0/src/utils.js not supported.
 *
 * A CAUSA RAIZ NÃO É configuração de bundler. É um bug de publicação do
 * `jwks-rsa@4.1.0` (dependência de `firebase-admin/auth`): o CÓDIGO-FONTE
 * dele — `const jose = require('jose')`, síncrono, cru — está incompatível
 * com a própria dependência que ele declara no `package.json`
 * (`jose: ^6.1.3`, que a partir da v6 é ESM-only). `require()` síncrono de
 * um pacote ESM-only sempre quebra, não importa o que empacote em volta.
 *
 * TENTATIVAS QUE NÃO FUNCIONARAM (documentadas para não repetir):
 *   1. Tirar `firebase-admin` de `serverExternalPackages` — sem efeito.
 *   2. `transpilePackages: ['jose', 'jwks-rsa']` — sem efeito.
 *   3. `node_bundler = "esbuild"` no netlify.toml — sem efeito.
 *   4. "Retry without cache" na Netlify (build 100% do zero) — mesmo erro,
 *      hash idêntico do módulo em todas as tentativas acima.
 *
 * Todas mudam ONDE/COMO o código é empacotado; nenhuma muda O QUE está no
 * arquivo-fonte do `jwks-rsa`, que é onde o `require()` problemático mora.
 *
 * FIX que funcionou: travar `jose` na v5 (última com suporte a CommonJS) via
 * `overrides` em `pnpm-workspace.yaml`. `jwks-rsa` só usa `jose` para
 * verificar assinatura JWT — API estável entre v5 e v6 para esse uso, sem
 * perda funcional.
 */

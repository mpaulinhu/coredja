import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Pacotes que rodam apenas no servidor e nunca devem ser empacotados para o
   * navegador. Ambos usam código nativo e acesso a disco: sem esta declaração,
   * o build tenta processá-los e falha.
   *
   * Também é uma garantia de segurança: o `firebase-admin` ignora as regras
   * do Firestore, e não pode existir nem por engano do lado do cliente.
   */
  serverExternalPackages: ['better-sqlite3', 'firebase-admin'],
};

export default nextConfig;

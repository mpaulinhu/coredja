import { firebaseStore } from './firebase-store';
import { sqliteStore } from './sqlite-store';
import type { Store } from './types';

/**
 * O armazenamento usado pela plataforma.
 *
 * As duas implementações convivem, e a escolha é feita por `COREDJA_STORAGE`
 * no arquivo `.env.local`:
 *
 *   COREDJA_STORAGE=sqlite     → arquivo local, não depende de internet
 *   COREDJA_STORAGE=firebase   → Cloud Firestore, na nuvem
 *
 * Manter as duas vivas custa pouco e resolve dois problemas reais: dá para
 * comparar comportamento durante a migração, e dá para voltar ao local em
 * segundos se a internet cair no meio de um culto.
 *
 * As telas importam `store` daqui e conhecem apenas a interface `Store`,
 * nunca a implementação.
 */

function escolher(): Store {
  const escolha = (process.env.COREDJA_STORAGE ?? 'sqlite').toLowerCase();

  switch (escolha) {
    case 'firebase':
    case 'firestore':
      return firebaseStore;
    case 'sqlite':
    case 'local':
      return sqliteStore;
    default:
      throw new Error(
        `COREDJA_STORAGE tem o valor "${escolha}", que não é válido. ` +
          'Use "sqlite" (armazenamento local) ou "firebase" (nuvem).',
      );
  }
}

export const store: Store = escolher();

/** Qual armazenamento está ativo. Usado na home, para deixar isso visível. */
export const ARMAZENAMENTO_ATIVO: 'sqlite' | 'firebase' =
  store === firebaseStore ? 'firebase' : 'sqlite';

export type { Store };

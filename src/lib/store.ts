import { sqliteStore } from './sqlite-store';
import type { Store } from './types';

/**
 * O armazenamento usado pela plataforma.
 *
 * Este é o ponto de troca da migração para Firebase. Todo o resto do código
 * importa `store` daqui e conhece apenas a interface `Store`, nunca a
 * implementação. Migrar é escrever `firebase-store.ts` satisfazendo `Store` e
 * trocar a linha abaixo.
 */
export const store: Store = sqliteStore;

export type { Store };

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Conexão com o banco local.
 *
 * O banco é um arquivo em `dados/coredja.db`, na raiz do projeto. Não há
 * servidor de banco para instalar ou manter ligado: se o arquivo existe, os
 * recados existem. Fazer backup é copiar esse arquivo.
 */

const RAIZ_DADOS = path.join(process.cwd(), 'dados');
const ARQUIVO_DB = path.join(RAIZ_DADOS, 'coredja.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS areas (
  slug  TEXT PRIMARY KEY,
  nome  TEXT NOT NULL,
  token TEXT NOT NULL,
  cor   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mensagens (
  id           TEXT PRIMARY KEY,
  area_slug    TEXT NOT NULL REFERENCES areas(slug),
  autor        TEXT NOT NULL CHECK (autor IN ('area', 'audiovisual')),
  texto        TEXT NOT NULL,
  prioridade   TEXT NOT NULL CHECK (prioridade IN ('normal', 'urgente')),
  criada_em    TEXT NOT NULL,
  resolvida_em TEXT
);

CREATE TABLE IF NOT EXISTS anexos (
  id           TEXT PRIMARY KEY,
  mensagem_id  TEXT NOT NULL REFERENCES mensagens(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo         TEXT NOT NULL,
  tamanho      INTEGER NOT NULL,
  url          TEXT NOT NULL
);

-- O painel busca pendentes a cada evento; este índice mantém isso barato
-- mesmo depois de milhares de recados acumulados no histórico.
CREATE INDEX IF NOT EXISTS idx_mensagens_pendentes
  ON mensagens (resolvida_em, criada_em DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_area
  ON mensagens (area_slug, criada_em DESC);

CREATE INDEX IF NOT EXISTS idx_anexos_mensagem
  ON anexos (mensagem_id);
`;

let instancia: Database.Database | null = null;

/**
 * Devolve a conexão com o banco, criando o arquivo e as tabelas na primeira
 * chamada. Em desenvolvimento o Next recarrega os módulos a cada alteração, o
 * que abriria uma conexão nova a cada vez — por isso a instância também fica
 * pendurada em `globalThis`.
 */
export function getDb(): Database.Database {
  if (instancia) return instancia;

  const cache = globalThis as typeof globalThis & {
    __coredjaDb?: Database.Database;
  };
  if (cache.__coredjaDb) {
    instancia = cache.__coredjaDb;
    return instancia;
  }

  if (!existsSync(RAIZ_DADOS)) mkdirSync(RAIZ_DADOS, { recursive: true });

  const db = new Database(ARQUIVO_DB);

  // WAL permite que o painel leia enquanto uma área grava, sem travar nenhum
  // dos dois — o cenário normal aqui, com vários celulares simultâneos.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(SCHEMA);

  instancia = db;
  cache.__coredjaDb = db;
  return db;
}

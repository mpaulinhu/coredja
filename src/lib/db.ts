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

/** Slug reservado do departamento de audiovisual — espelha `conversas.ts`
 *  (este arquivo não importa dali para não criar dependência circular com
 *  `sqlite-store.ts`, que já importa `db.ts`). */
const AUDIOVISUAL_SLUG = 'audiovisual';

/** Mesmo algoritmo de `idDaConversa` em `conversas.ts` — ver nota acima. */
function idDaConversa(a: string, b: string): string {
  return [a, b].sort().join('__');
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS departamentos (
  slug  TEXT PRIMARY KEY,
  nome  TEXT NOT NULL,
  cor   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mensagens (
  id           TEXT PRIMARY KEY,
  conversa_id  TEXT NOT NULL,
  depto_a      TEXT NOT NULL,
  depto_b      TEXT NOT NULL,
  remetente    TEXT NOT NULL,
  texto        TEXT NOT NULL,
  prioridade   TEXT CHECK (prioridade IN ('normal', 'urgente')),
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

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa
  ON mensagens (conversa_id, criada_em DESC);

CREATE INDEX IF NOT EXISTS idx_anexos_mensagem
  ON anexos (mensagem_id);
`;

/**
 * Migra o schema antigo (`areas` + `mensagens.area_slug`/`autor`) para o novo
 * (`departamentos` + `mensagens.conversa_id`/`remetente`/`depto_a`/`depto_b`).
 *
 * Roda como bloco condicional — só age se a coluna antiga (`area_slug`) ainda
 * existir — para ser idempotente em quem já migrou. `depto_a`/`depto_b` são
 * gravados na própria linha (em vez de derivados de `idDaConversa` a cada
 * leitura) porque é a forma mais simples de implementar corretamente
 * `listarConversasComMensagem` sem reprocessar o id toda vez.
 */
function migrarSchemaAntigo(db: Database.Database): void {
  const temColunaAntiga = (
    db.prepare(`PRAGMA table_info(mensagens)`).all() as { name: string }[]
  ).some((coluna) => coluna.name === 'area_slug');

  if (!temColunaAntiga) return;

  const migrar = db.transaction(() => {
    // 1. departamentos: renomeia a tabela e dropa a coluna token.
    db.exec(`ALTER TABLE areas RENAME TO departamentos_antigo`);
    db.exec(`
      CREATE TABLE departamentos (
        slug TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        cor  TEXT NOT NULL
      )
    `);
    db.exec(`
      INSERT INTO departamentos (slug, nome, cor)
      SELECT slug, nome, cor FROM departamentos_antigo
    `);
    db.exec(`DROP TABLE departamentos_antigo`);

    // Garante o audiovisual, que antes não era uma "área" cadastrada.
    db.prepare(
      `INSERT OR IGNORE INTO departamentos (slug, nome, cor) VALUES (?, ?, ?)`,
    ).run(AUDIOVISUAL_SLUG, 'Audiovisual', '#6366f1');

    // 2. mensagens: cria a tabela nova e migra linha a linha em JS — mais
    // simples e seguro que replicar idDaConversa em SQL puro.
    db.exec(`ALTER TABLE mensagens RENAME TO mensagens_antigo`);
    db.exec(`
      CREATE TABLE mensagens (
        id           TEXT PRIMARY KEY,
        conversa_id  TEXT NOT NULL,
        depto_a      TEXT NOT NULL,
        depto_b      TEXT NOT NULL,
        remetente    TEXT NOT NULL,
        texto        TEXT NOT NULL,
        prioridade   TEXT CHECK (prioridade IN ('normal', 'urgente')),
        criada_em    TEXT NOT NULL,
        resolvida_em TEXT
      )
    `);

    interface LinhaAntiga {
      id: string;
      area_slug: string;
      autor: string;
      texto: string;
      prioridade: string;
      criada_em: string;
      resolvida_em: string | null;
    }
    const antigas = db
      .prepare(`SELECT * FROM mensagens_antigo`)
      .all() as LinhaAntiga[];

    const inserir = db.prepare(`
      INSERT INTO mensagens
        (id, conversa_id, depto_a, depto_b, remetente, texto, prioridade, criada_em, resolvida_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const linha of antigas) {
      const [a, b] = [linha.area_slug, AUDIOVISUAL_SLUG].sort();
      const remetente = linha.autor === 'area' ? linha.area_slug : AUDIOVISUAL_SLUG;
      inserir.run(
        linha.id,
        idDaConversa(linha.area_slug, AUDIOVISUAL_SLUG),
        a,
        b,
        remetente,
        linha.texto,
        linha.prioridade,
        linha.criada_em,
        linha.resolvida_em,
      );
    }

    db.exec(`DROP TABLE mensagens_antigo`);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mensagens_pendentes
        ON mensagens (resolvida_em, criada_em DESC)
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mensagens_conversa
        ON mensagens (conversa_id, criada_em DESC)
    `);
  });

  migrar();
}

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

  // A migração precisa rodar ANTES do schema novo criar `departamentos`/
  // `mensagens`: `CREATE TABLE IF NOT EXISTS` não recria uma tabela já
  // existente, então se o schema rodasse primeiro numa instalação antiga a
  // migração acharia a tabela nova vazia em vez da antiga com dados.
  migrarSchemaAntigo(db);
  db.exec(SCHEMA);

  instancia = db;
  cache.__coredjaDb = db;
  return db;
}

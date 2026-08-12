import { nanoid } from 'nanoid';
import { AREAS } from './areas';
import { getDb } from './db';
import type { Area, Mensagem, NovaMensagem, Store } from './types';

/**
 * Implementação de `Store` sobre SQLite local.
 *
 * Este é o único arquivo que conhece SQL. Trocar para Firebase significa
 * escrever um `firebase-store.ts` que satisfaça a mesma interface `Store` e
 * apontar `store.ts` para ele — nenhuma tela muda.
 */

interface LinhaMensagem {
  id: string;
  area_slug: string;
  autor: string;
  texto: string;
  prioridade: string;
  criada_em: string;
  resolvida_em: string | null;
}

interface LinhaAnexo {
  id: string;
  mensagem_id: string;
  nome_arquivo: string;
  tipo: string;
  tamanho: number;
  url: string;
}

/**
 * Grava no banco as áreas definidas em `areas.ts`.
 *
 * Roda a cada início. Nome, cor e token são sobrescritos pelo que está no
 * código, que é a fonte da verdade — assim trocar um token vazado é editar o
 * arquivo e reiniciar.
 */
function semearAreas(): void {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO areas (slug, nome, token, cor)
    VALUES (@slug, @nome, @token, @cor)
    ON CONFLICT(slug) DO UPDATE SET
      nome  = excluded.nome,
      token = excluded.token,
      cor   = excluded.cor
  `);
  const tx = db.transaction((areas: Area[]) => {
    for (const area of areas) upsert.run(area);
  });
  tx(AREAS);
}

let semeado = false;
function garantirSemeadura(): void {
  if (semeado) return;
  semearAreas();
  semeado = true;
}

/** Junta cada mensagem aos seus anexos, numa consulta só para todos eles. */
function montarMensagens(linhas: LinhaMensagem[]): Mensagem[] {
  if (linhas.length === 0) return [];

  const db = getDb();
  const marcadores = linhas.map(() => '?').join(',');
  const anexos = db
    .prepare(
      `SELECT * FROM anexos WHERE mensagem_id IN (${marcadores}) ORDER BY rowid`,
    )
    .all(...linhas.map((l) => l.id)) as LinhaAnexo[];

  const porMensagem = new Map<string, LinhaAnexo[]>();
  for (const anexo of anexos) {
    const lista = porMensagem.get(anexo.mensagem_id) ?? [];
    lista.push(anexo);
    porMensagem.set(anexo.mensagem_id, lista);
  }

  return linhas.map((linha) => ({
    id: linha.id,
    areaSlug: linha.area_slug,
    autor: linha.autor as Mensagem['autor'],
    texto: linha.texto,
    prioridade: linha.prioridade as Mensagem['prioridade'],
    criadaEm: linha.criada_em,
    resolvidaEm: linha.resolvida_em,
    anexos: (porMensagem.get(linha.id) ?? []).map((a) => ({
      id: a.id,
      nomeArquivo: a.nome_arquivo,
      tipo: a.tipo,
      tamanho: a.tamanho,
      url: a.url,
    })),
  }));
}

function buscarMensagem(id: string): Mensagem | null {
  const db = getDb();
  const linha = db.prepare('SELECT * FROM mensagens WHERE id = ?').get(id) as
    | LinhaMensagem
    | undefined;
  if (!linha) return null;
  return montarMensagens([linha])[0];
}

export const sqliteStore: Store = {
  async listarAreas() {
    garantirSemeadura();
    return getDb().prepare('SELECT * FROM areas ORDER BY nome').all() as Area[];
  },

  async buscarArea(slug) {
    garantirSemeadura();
    const area = getDb()
      .prepare('SELECT * FROM areas WHERE slug = ?')
      .get(slug) as Area | undefined;
    return area ?? null;
  },

  async autenticarArea(slug, token) {
    garantirSemeadura();
    const area = getDb()
      .prepare('SELECT * FROM areas WHERE slug = ? AND token = ?')
      .get(slug, token) as Area | undefined;
    return area ?? null;
  },

  async criarMensagem(dados: NovaMensagem) {
    garantirSemeadura();
    const db = getDb();
    const id = nanoid();
    const criadaEm = new Date().toISOString();

    const inserirMensagem = db.prepare(`
      INSERT INTO mensagens
        (id, area_slug, autor, texto, prioridade, criada_em, resolvida_em)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `);
    const inserirAnexo = db.prepare(`
      INSERT INTO anexos
        (id, mensagem_id, nome_arquivo, tipo, tamanho, url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Mensagem e anexos entram juntos: um recado nunca aparece no painel com
    // a imagem faltando por gravação parcial.
    const tx = db.transaction(() => {
      inserirMensagem.run(
        id,
        dados.areaSlug,
        dados.autor,
        dados.texto,
        dados.prioridade,
        criadaEm,
      );
      for (const anexo of dados.anexos) {
        inserirAnexo.run(
          nanoid(),
          id,
          anexo.nomeArquivo,
          anexo.tipo,
          anexo.tamanho,
          anexo.url,
        );
      }
    });
    tx();

    return buscarMensagem(id)!;
  },

  async listarPendentes() {
    garantirSemeadura();
    // Urgentes primeiro; dentro de cada grupo, o mais recente no topo.
    const linhas = getDb()
      .prepare(
        `SELECT * FROM mensagens
         WHERE resolvida_em IS NULL
         ORDER BY CASE prioridade WHEN 'urgente' THEN 0 ELSE 1 END,
                  criada_em DESC`,
      )
      .all() as LinhaMensagem[];
    return montarMensagens(linhas);
  },

  async listarHistorico(limite = 100) {
    garantirSemeadura();
    const linhas = getDb()
      .prepare(
        `SELECT * FROM mensagens
         WHERE resolvida_em IS NOT NULL
         ORDER BY resolvida_em DESC
         LIMIT ?`,
      )
      .all(limite) as LinhaMensagem[];
    return montarMensagens(linhas);
  },

  async listarPorArea(areaSlug, limite = 50) {
    garantirSemeadura();
    // Busca em ordem decrescente para pegar as mais recentes, depois inverte:
    // a área lê a conversa de cima para baixo, como num aplicativo de mensagem.
    const linhas = getDb()
      .prepare(
        `SELECT * FROM mensagens
         WHERE area_slug = ?
         ORDER BY criada_em DESC
         LIMIT ?`,
      )
      .all(areaSlug, limite) as LinhaMensagem[];
    return montarMensagens(linhas).reverse();
  },

  async resolverMensagem(id) {
    garantirSemeadura();
    getDb()
      .prepare('UPDATE mensagens SET resolvida_em = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
    return buscarMensagem(id);
  },

  async reabrirMensagem(id) {
    garantirSemeadura();
    getDb()
      .prepare('UPDATE mensagens SET resolvida_em = NULL WHERE id = ?')
      .run(id);
    return buscarMensagem(id);
  },
};

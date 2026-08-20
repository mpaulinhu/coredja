import { nanoid } from 'nanoid';
import { AUDIOVISUAL_SLUG } from './conversa-compartilhado';
import { getDb } from './db';
import type {
  ConversaComMensagem,
  Departamento,
  Mensagem,
  NovaMensagem,
  Store,
} from './types';

/**
 * Implementação de `Store` sobre SQLite local.
 *
 * Este é o único arquivo que conhece SQL. Trocar para Firebase significa
 * escrever um `firebase-store.ts` que satisfaça a mesma interface `Store` e
 * apontar `store.ts` para ele — nenhuma tela muda.
 */

/** Departamentos semeados na primeira execução, se o banco estiver vazio. */
const DEPARTAMENTOS_INICIAIS: Departamento[] = [
  { slug: AUDIOVISUAL_SLUG, nome: 'Audiovisual', cor: '#6366f1' },
  { slug: 'cantina', nome: 'Cantina', cor: '#e07a3f' },
  { slug: 'kids', nome: 'Kids', cor: '#3f8fe0' },
];

interface LinhaMensagem {
  id: string;
  conversa_id: string;
  depto_a: string;
  depto_b: string;
  remetente: string;
  autor: string | null;
  texto: string;
  prioridade: string | null;
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
 * Garante que os departamentos iniciais existam. Diferente do comportamento
 * antigo de `areas.ts` (código como fonte da verdade, sobrescrito a cada
 * início), `departamentos` agora é editável via CRUD — então isto só insere
 * o que ainda não existe (`INSERT OR IGNORE`), nunca sobrescreve.
 */
function semearDepartamentos(): void {
  const db = getDb();
  const inserir = db.prepare(`
    INSERT OR IGNORE INTO departamentos (slug, nome, cor)
    VALUES (@slug, @nome, @cor)
  `);
  const tx = db.transaction((departamentos: Departamento[]) => {
    for (const departamento of departamentos) inserir.run(departamento);
  });
  tx(DEPARTAMENTOS_INICIAIS);
}

let semeado = false;
function garantirSemeadura(): void {
  if (semeado) return;
  semearDepartamentos();
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
    conversaId: linha.conversa_id,
    remetente: linha.remetente,
    // `?? undefined` porque o banco guarda NULL e o tipo usa opcional.
    autor: linha.autor ?? undefined,
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
  async listarDepartamentos() {
    garantirSemeadura();
    return getDb()
      .prepare('SELECT * FROM departamentos ORDER BY nome')
      .all() as Departamento[];
  },

  async buscarDepartamento(slug) {
    garantirSemeadura();
    const departamento = getDb()
      .prepare('SELECT * FROM departamentos WHERE slug = ?')
      .get(slug) as Departamento | undefined;
    return departamento ?? null;
  },

  async criarDepartamento(dados) {
    garantirSemeadura();
    getDb()
      .prepare(
        'INSERT INTO departamentos (slug, nome, cor) VALUES (@slug, @nome, @cor)',
      )
      .run(dados);
    return dados;
  },

  async atualizarDepartamento(slug, dados) {
    garantirSemeadura();
    const db = getDb();
    const existente = db
      .prepare('SELECT * FROM departamentos WHERE slug = ?')
      .get(slug) as Departamento | undefined;
    if (!existente) return null;

    db.prepare('UPDATE departamentos SET nome = ?, cor = ? WHERE slug = ?').run(
      dados.nome,
      dados.cor,
      slug,
    );
    return { slug, ...dados };
  },

  async removerDepartamento(slug) {
    garantirSemeadura();
    getDb().prepare('DELETE FROM departamentos WHERE slug = ?').run(slug);
  },

  async criarMensagem(dados: NovaMensagem) {
    garantirSemeadura();
    const db = getDb();
    const id = nanoid();
    const criadaEm = new Date().toISOString();

    const partes = dados.conversaId.split('__');
    const [deptoA, deptoB] = [partes[0], partes[1] ?? partes[0]];

    const inserirMensagem = db.prepare(`
      INSERT INTO mensagens
        (id, conversa_id, depto_a, depto_b, remetente, autor, texto, prioridade, criada_em, resolvida_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
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
        dados.conversaId,
        deptoA,
        deptoB,
        dados.remetente,
        dados.autor ?? null,
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

  async listarPorConversa(conversaId, limite = 50) {
    garantirSemeadura();
    // Busca em ordem decrescente para pegar as mais recentes, depois inverte:
    // a conversa é lida de cima para baixo, como num aplicativo de mensagem.
    const linhas = getDb()
      .prepare(
        `SELECT * FROM mensagens
         WHERE conversa_id = ?
         ORDER BY criada_em DESC
         LIMIT ?`,
      )
      .all(conversaId, limite) as LinhaMensagem[];
    return montarMensagens(linhas).reverse();
  },

  async listarConversasComMensagem() {
    garantirSemeadura();
    // depto_a/depto_b já vêm gravados por linha (ver criarMensagem e a
    // migração em db.ts), então um DISTINCT simples resolve sem precisar
    // reprocessar idDaConversa aqui.
    return getDb()
      .prepare(
        `SELECT DISTINCT conversa_id AS conversaId, depto_a AS deptoA, depto_b AS deptoB
         FROM mensagens`,
      )
      .all() as ConversaComMensagem[];
  },

  async buscarMensagem(id) {
    garantirSemeadura();
    return buscarMensagem(id);
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

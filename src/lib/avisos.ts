/**
 * Contrato de dados dos Avisos do Telão.
 *
 * Ao contrário da Ordem do Culto (um documento só, o "culto de hoje"), aviso
 * é uma LISTA: vários cadastrados durante a semana, dos quais um — no máximo
 * — está "no ar" a qualquer momento. É essa a tela que expôs a premissa
 * errada do primeiro mapa: cadastrar acontece na semana, publicar acontece no
 * domingo, e são pessoas diferentes fazendo isso em momentos diferentes.
 */

import type { Anexo } from './types';

/**
 * A arte do aviso.
 *
 * É o `Anexo` dos recados sem o `id`: um aviso tem no máximo uma imagem, e
 * `id` só existe lá para diferenciar itens de uma lista. Tirar o campo evita
 * gravar um valor vazio no Firestore que ninguém lê — `ImagemAnexo` usa
 * apenas `nomeArquivo` e `url`.
 */
export type ImagemDoAviso = Omit<Anexo, 'id'>;

export interface Aviso {
  id: string;
  titulo: string;
  texto: string;
  /**
   * Arte pronta para projetar, quando o aviso é uma imagem em vez de texto.
   *
   * Reaproveita o `Anexo` dos recados de propósito: é o mesmo caminho de
   * gravação (`salvarImagem`), o mesmo componente de exibição
   * (`ImagemAnexo`) e o mesmo campo `url` opaco — data URI quando hospedado,
   * caminho de rota quando roda no PC do audiovisual.
   */
  imagem?: ImagemDoAviso;
  /**
   * Dias em que o aviso vale, no formato `"YYYY-MM-DD"` (o mesmo de
   * `culto.ts`). Lista vazia significa "vale sempre" — é o estado dos avisos
   * cadastrados antes desta funcionalidade existir, e o default de quem não
   * quer agendar nada.
   */
  dias: string[];
  /** Se este é o aviso mostrado no telão agora. No máximo um por vez. */
  noAr: boolean;
  criadoPor: string;
  criadoEm: string; // ISO 8601 em UTC
}

/** O que a tela de cadastro envia ao criar um aviso. */
export interface NovoAviso {
  titulo: string;
  texto: string;
  imagem?: ImagemDoAviso;
  dias: string[];
}

/** Um aviso vale hoje se não tem dia marcado, ou se hoje está entre os dias. */
export function valeNoDia(aviso: Aviso, dia: string): boolean {
  return aviso.dias.length === 0 || aviso.dias.includes(dia);
}

/**
 * Ordena para quem vai publicar no domingo: primeiro o que vale hoje, depois
 * o resto, e dentro de cada grupo do mais novo para o mais antigo.
 */
export function ordenarParaPublicar(avisos: Aviso[], hoje: string): Aviso[] {
  return [...avisos].sort((a, b) => {
    const aHoje = valeNoDia(a, hoje) ? 0 : 1;
    const bHoje = valeNoDia(b, hoje) ? 0 : 1;
    if (aHoje !== bHoje) return aHoje - bHoje;
    return b.criadoEm.localeCompare(a.criadoEm);
  });
}

/**
 * Normaliza um documento vindo do Firestore.
 *
 * Avisos cadastrados antes de `dias`/`imagem` existirem não têm esses campos.
 * Em vez de um script de migração, a leitura preenche os defaults: sem dia
 * marcado (vale sempre) e sem imagem (aviso só de texto).
 */
export function normalizarAviso(bruto: Partial<Aviso> & { id: string }): Aviso {
  return {
    id: bruto.id,
    titulo: bruto.titulo ?? '',
    texto: bruto.texto ?? '',
    ...(bruto.imagem ? { imagem: bruto.imagem } : {}),
    dias: Array.isArray(bruto.dias) ? bruto.dias : [],
    noAr: bruto.noAr === true,
    criadoPor: bruto.criadoPor ?? '',
    criadoEm: bruto.criadoEm ?? '',
  };
}

export interface StoreAvisos {
  listar(): Promise<Aviso[]>;
  criar(dados: NovoAviso, autor: string): Promise<Aviso>;
  remover(id: string): Promise<void>;
  buscar(id: string): Promise<Aviso | null>;
  /** Põe este aviso no ar e tira qualquer outro que estivesse — nunca dois
   *  ao mesmo tempo. */
  publicar(id: string): Promise<Aviso[]>;
  /** Tira o aviso do ar. O telão volta a não mostrar nenhum. */
  ocultar(id: string): Promise<Aviso[]>;
}

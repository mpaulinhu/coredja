import { AUDIOVISUAL_SLUG } from './conversa-compartilhado';

/**
 * Regras de forma de um departamento, compartilhadas pelas rotas de API.
 *
 * Ficam fora das rotas porque `POST /api/departamentos` e
 * `PUT /api/departamentos/[slug]` validam nome e cor da mesma maneira — e
 * uma divergência entre as duas só apareceria como dado torto no banco.
 */

/** O slug reservado não pode ser apagado — ver `conversaTemUrgencia`. */
export function ehSlugReservado(slug: string): boolean {
  return slug === AUDIOVISUAL_SLUG;
}

/**
 * Transforma um nome em slug: minúsculo, sem acento, espaços viram hífen.
 *
 * "Louvor & Adoração" → "louvor-adoracao". A normalização NFD separa a letra
 * do acento, e o intervalo \u0300-\u036f apaga só os acentos soltos.
 */
export function slugDoNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Motivo pelo qual o slug não serve, ou null se estiver bom.
 *
 * O `__` é proibido porque `idDaConversa` junta dois slugs com ele; um slug
 * que o contenha faria o split devolver três pedaços e a conversa apontaria
 * para um departamento inexistente.
 */
export function problemaNoSlug(slug: string): string | null {
  if (!slug) return 'Não foi possível gerar um endereço a partir desse nome. Use letras ou números.';
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return 'O endereço só pode ter letras minúsculas, números e hífen.';
  }
  if (slug.includes('__')) {
    return 'O endereço não pode conter dois sublinhados seguidos.';
  }
  if (slug.length > 40) return 'O endereço ficou longo demais. Use um nome mais curto.';
  return null;
}

/** Motivo pelo qual o nome não serve, ou null se estiver bom. */
export function problemaNoNome(nome: string): string | null {
  if (!nome) return 'Informe o nome do departamento.';
  if (nome.length > 40) return 'O nome pode ter no máximo 40 caracteres.';
  return null;
}

/** Motivo pelo qual a cor não serve, ou null se estiver boa. */
export function problemaNaCor(cor: string): string | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(cor)) {
    return 'A cor precisa estar no formato #rrggbb.';
  }
  return null;
}

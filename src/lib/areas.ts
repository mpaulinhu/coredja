import type { Area } from './types';

/**
 * Áreas da igreja que falam com o audiovisual.
 *
 * Ficam aqui, em código, em vez de numa tela de cadastro: são duas, mudam
 * quase nunca, e uma tela de administração para isso seria trabalho sem
 * retorno. Adicionar uma área é acrescentar um item nesta lista e reiniciar.
 *
 * O `token` é o trecho secreto do link de cada área (/a/{slug}-{token}).
 * Para invalidar um link que vazou, troque o token e reinicie: o link antigo
 * para de funcionar na hora e o histórico continua intacto.
 */
export const AREAS: Area[] = [
  {
    slug: 'cantina',
    nome: 'Cantina',
    token: 'x7k2m9',
    cor: '#e07a3f',
  },
  {
    slug: 'kids',
    nome: 'Kids',
    token: 'p4w8n3',
    cor: '#3f8fe0',
  },
];

/** Monta o caminho de acesso de uma área, como ela recebe no celular. */
export function caminhoDaArea(area: Area): string {
  return `/a/${area.slug}-${area.token}`;
}

/**
 * Separa o parâmetro de URL `{slug}-{token}` em suas duas partes.
 *
 * Divide no último hífen, e não no primeiro, para que slugs compostos
 * (ex: "kids-sala-2") continuem funcionando.
 */
export function separarChaveDeAcesso(
  chave: string,
): { slug: string; token: string } | null {
  const corte = chave.lastIndexOf('-');
  if (corte <= 0 || corte === chave.length - 1) return null;
  return {
    slug: chave.slice(0, corte),
    token: chave.slice(corte + 1),
  };
}

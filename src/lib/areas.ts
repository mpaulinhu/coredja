import type { Area } from './types';

/**
 * Áreas da igreja que falam com o audiovisual.
 *
 * Ficam aqui, em código, em vez de numa tela de cadastro: são poucas, mudam
 * quase nunca, e uma tela de administração para isso seria trabalho sem
 * retorno. Adicionar uma área é acrescentar um item nesta lista.
 *
 * O `token` NÃO fica aqui. Ele é o trecho secreto do link de cada área
 * (`/a/{slug}-{token}`) e este repositório é público — quem lesse o código
 * teria o link de todas as áreas e poderia mandar recado se passando por
 * elas. Cada token vem de uma variável de ambiente própria, definida em
 * `.env.local` (no PC) ou no painel da hospedagem.
 */

/** Uma área, sem o segredo. O token entra depois, vindo do ambiente. */
type DefinicaoDeArea = Omit<Area, 'token'> & {
  /** Nome da variável de ambiente que guarda o token desta área. */
  variavelDoToken: string;
};

const DEFINICOES: DefinicaoDeArea[] = [
  {
    slug: 'cantina',
    nome: 'Cantina',
    cor: '#e07a3f',
    variavelDoToken: 'COREDJA_TOKEN_CANTINA',
  },
  {
    slug: 'kids',
    nome: 'Kids',
    cor: '#3f8fe0',
    variavelDoToken: 'COREDJA_TOKEN_KIDS',
  },
];

/**
 * Token de uso local, quando a variável de ambiente não está definida.
 *
 * Existe para quem baixa o projeto conseguir rodar e ver funcionando sem
 * configurar nada. É previsível de propósito e **não protege nada** — por isso
 * o servidor recusa usá-lo quando a plataforma está publicada (ver abaixo).
 */
function tokenDeDesenvolvimento(slug: string): string {
  return `dev-${slug}`;
}

/** Se a plataforma está rodando publicada, e não no PC de alguém. */
function estaPublicada(): boolean {
  // Definidas automaticamente por Netlify e Vercel. Localmente não existem.
  return Boolean(process.env.NETLIFY || process.env.VERCEL);
}

function tokenDaArea(definicao: DefinicaoDeArea): string {
  const doAmbiente = process.env[definicao.variavelDoToken]?.trim();
  if (doAmbiente) return doAmbiente;

  if (estaPublicada()) {
    throw new Error(
      `A variável ${definicao.variavelDoToken} não está definida.\n\n` +
        `Sem ela o link da área "${definicao.nome}" seria previsível, e ` +
        'qualquer pessoa poderia mandar recado se passando por ela.\n\n' +
        'Cadastre um valor secreto qualquer nas variáveis de ambiente da ' +
        'hospedagem (letras e números, sem espaço) e publique de novo.',
    );
  }

  return tokenDeDesenvolvimento(definicao.slug);
}

/**
 * As áreas, já com os tokens resolvidos.
 *
 * Só o servidor importa este arquivo — os tokens nunca chegam ao navegador
 * nem ao Firestore.
 */
export const AREAS: Area[] = DEFINICOES.map((definicao) => ({
  slug: definicao.slug,
  nome: definicao.nome,
  cor: definicao.cor,
  token: tokenDaArea(definicao),
}));

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

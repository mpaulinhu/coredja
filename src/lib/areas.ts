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
/**
 * O slug não pode conter hífen: ele é o que vem antes do primeiro hífen no
 * link da área (ver `separarChaveDeAcesso`). Um slug com hífen faria a área
 * nunca ser encontrada, com um 404 silencioso e difícil de rastrear — então
 * o erro estoura aqui, ao subir, em vez de só na hora de abrir o link.
 */
for (const definicao of DEFINICOES) {
  if (definicao.slug.includes('-')) {
    throw new Error(
      `O slug "${definicao.slug}" contém hífen, e isso quebraria o link da ` +
        `área "${definicao.nome}". ` +
        'Use um slug sem hífen (ex: "kidssala2" no lugar de "kids-sala-2").',
    );
  }
}

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
 * Divide no PRIMEIRO hífen, porque o token é gerado aleatoriamente e pode
 * conter hífen (o alfabeto padrão do `nanoid` inclui `-` e `_`). Cortar no
 * último hífen levaria parte do token para dentro do slug, e a área não
 * seria encontrada — era o que acontecia com um dos tokens em uso.
 *
 * Em troca, os slugs não podem conter hífen. São poucos e definidos aqui em
 * código (`DEFINICOES` acima), então isso é fácil de garantir — ao contrário
 * do token, que é sorteado.
 */
export function separarChaveDeAcesso(
  chave: string,
): { slug: string; token: string } | null {
  const corte = chave.indexOf('-');
  if (corte <= 0 || corte === chave.length - 1) return null;
  return {
    slug: chave.slice(0, corte),
    token: chave.slice(corte + 1),
  };
}

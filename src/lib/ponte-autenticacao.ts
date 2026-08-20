/**
 * Como a ponte prova que é ela.
 *
 * A ponte não é uma pessoa: não tem e-mail, não faz login, e roda sozinha no
 * PC do audiovisual desde que o Windows liga. `pessoaDaRequisicao` (que
 * confere o token do Firebase Authentication) não serve — criar uma "conta de
 * pessoa" para um programa seria pior, porque essa conta apareceria na tela
 * de Usuários como se fosse gente, e alguém acabaria editando o cargo dela.
 *
 * Então a ponte usa um segredo próprio, cadastrado no servidor como
 * `COREDJA_TOKEN_PONTE` e colado uma vez na instalação. Ela só consegue duas
 * coisas com ele — dizer que está viva e pegar comandos da fila —, nunca ler
 * recado, culto ou pessoa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SEM TOKEN CADASTRADO, A PORTA FICA FECHADA
 * ────────────────────────────────────────────────────────────────────────────
 * Se `COREDJA_TOKEN_PONTE` não estiver definido, estas rotas recusam TUDO —
 * em vez de, por exemplo, aceitar qualquer requisição "porque ainda não foi
 * configurado". Um valor ausente vira negação, nunca permissão: é o mesmo
 * princípio de `areasVisiveis` vazio significar "não fala com ninguém".
 */

/**
 * Compara dois segredos sem vazar, pelo tempo de resposta, quantos caracteres
 * do começo batem.
 *
 * Uma comparação comum (`a === b`) para no primeiro caractere diferente, então
 * um segredo que acerta o primeiro caractere demora um pouquinho mais para ser
 * recusado que um que erra logo de cara. Com muitas tentativas dá para
 * descobrir o valor caractere a caractere. Aqui todos os caracteres são sempre
 * percorridos, e o tempo não diz nada.
 *
 * É rigor barato: são poucas linhas, e a alternativa é um cuidado que só se
 * descobre estar faltando quando já foi explorado.
 */
function comparacaoSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferenca === 0;
}

/** Se a requisição traz o segredo da ponte. */
export function ehAPonte(request: Request): boolean {
  const esperado = (process.env.COREDJA_TOKEN_PONTE ?? '').trim();
  // Sem segredo cadastrado, ninguém entra — ver a nota acima.
  if (!esperado) return false;

  const cabecalho = request.headers.get('authorization') ?? '';
  const [tipo, token] = cabecalho.split(' ');
  if (tipo !== 'Bearer' || !token) return false;

  return comparacaoSegura(token, esperado);
}

/** Resposta padrão para quem não provou ser a ponte. */
export function recusarPonte(): Response {
  return Response.json(
    { erro: 'Token da ponte inválido ou ausente.' },
    { status: 401 },
  );
}

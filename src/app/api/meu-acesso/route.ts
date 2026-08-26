import { abasDaPessoa } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * O que a pessoa logada alcança: papel e abas do menu.
 *
 * Existe porque o menu precisava saber isso e só tinha como perguntar de
 * lado — lia `podeEditar` de `/api/departamentos`, uma rota sobre outro
 * assunto, e daí deduzia "é admin". Funcionava para os dois itens de admin,
 * mas não para escolher aba a aba.
 *
 * Não é uma permissão nova: quem monta a lista é o servidor, a partir do
 * papel e do que o admin marcou (`abasDaPessoa`), e cada rota continua
 * conferindo o papel por conta própria. Esconder item de menu é sobre não
 * mostrar o que a pessoa não usa — nunca a trava em si.
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  return Response.json({
    papel: pessoa.papel,
    abas: abasDaPessoa(pessoa),
  });
}

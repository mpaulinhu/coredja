import { ultimasLinhasDoLogDaPonte } from '@/lib/telao-fila-store';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * As últimas linhas que o Conector (`coredja-ponte`) gravou.
 *
 * Existe para não depender de alguém estar fisicamente no PC do audiovisual
 * com acesso ao `registro.txt` — a tela de Configurações faz polling nesta
 * rota para mostrar o mesmo conteúdo remotamente.
 *
 * Mesma trava de `configuracoes:testar`: só quem administra o Coredja lê,
 * porque o log pode conter caminho de arquivo e o nome do computador da
 * igreja, e não há nenhum benefício em expor isso a mais gente do que
 * precisa.
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'departamentos:escrever')) {
    return Response.json(
      { erro: 'Só quem administra o Coredja vê o registro da ponte.' },
      { status: 403 },
    );
  }

  const linhas = await ultimasLinhasDoLogDaPonte();
  return Response.json({ linhas });
}

import { lerCorpoDaMensagem } from '@/lib/live';
import { mensagensDaLiveStore } from '@/lib/live-store';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * As mensagens cadastradas para a transmissão.
 *
 * Basta estar logado: copiar é leitura, e quem opera a live precisa alcançar
 * a biblioteca inteira mesmo sem poder mexer nela.
 *
 * `podeEditar` vem junto pelo mesmo motivo que em `GET /api/departamentos`:
 * como esta rota responde 200 para qualquer pessoa logada, a tela não tem
 * como deduzir a permissão pelo status HTTP, e reimplementar a regra no
 * navegador criaria uma segunda fonte de verdade.
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const mensagens = await mensagensDaLiveStore.listar();
  return Response.json({
    mensagens,
    podeEditar: podeFazer(pessoa.papel, 'live:escrever'),
  });
}

/** Cadastra uma mensagem fixa. Só quem tem `live:escrever` (coordenador). */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'live:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode cadastrar mensagens da live.' },
      { status: 403 },
    );
  }

  const dados = await lerCorpoDaMensagem(request);
  if ('erro' in dados) {
    return Response.json({ erro: dados.erro }, { status: 400 });
  }

  const mensagem = await mensagensDaLiveStore.criar(dados, pessoa.nome);
  return Response.json({ mensagem }, { status: 201 });
}

import type { ResultadoDoTeste } from '@/lib/configuracoes-compartilhado';
import { testarConexaoHolyrics } from '@/lib/holyrics';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * Bate no Holyrics agora e conta o que voltou.
 *
 * POST, e não GET, apesar de não gravar nada: é uma chamada de rede para fora
 * com custo e efeito no tempo (até 5 segundos parado), e não deve ser
 * disparada por um prefetch de navegador nem cacheada por ninguém no caminho.
 *
 * A sonda é de LEITURA (`GetCommunicationPanelInfo`) de propósito — ver
 * `testarConexaoHolyrics`. Testar com um envio acenderia texto no telão da
 * igreja no meio do culto.
 */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'departamentos:escrever')) {
    return Response.json(
      { erro: 'Só quem administra o Coredja testa a conexão.' },
      { status: 403 },
    );
  }

  const diagnostico = await testarConexaoHolyrics();

  const resposta: ResultadoDoTeste =
    diagnostico.estado === 'ok'
      ? { estado: 'ok', painelNoAr: diagnostico.painelNoAr }
      : diagnostico.estado === 'ok-pela-ponte'
        ? { estado: 'ok-pela-ponte', computador: diagnostico.computador }
        : diagnostico.estado === 'ponte-sem-holyrics'
          ? { estado: 'ponte-sem-holyrics', computador: diagnostico.computador }
          : diagnostico.estado === 'sem-permissao'
            ? { estado: 'sem-permissao', acoesBloqueadas: diagnostico.acoesBloqueadas }
            : diagnostico.estado === 'nao-configurado'
              ? { estado: 'nao-configurado' }
              : { estado: diagnostico.estado, motivo: diagnostico.motivo };

  return Response.json(resposta);
}

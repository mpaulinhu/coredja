import { conversaTemUrgencia, montarConversas } from '@/lib/conversas';
import { publicar } from '@/lib/eventos';
import { MAXIMO_ANEXOS, TAMANHO_MAXIMO_TEXTO } from '@/lib/limites';
import { podeConversarCom } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { store } from '@/lib/store';
import { ErroDeUpload, salvarImagem } from '@/lib/uploads';
import type { Anexo, Prioridade } from '@/lib/types';

/**
 * Dados do painel e envio de mensagens entre departamentos.
 *
 * Protegido por login desde a adição de `areasVisiveis` (ver `papeis.ts`):
 * antes disso o painel era a única rota interna sem checagem de sessão,
 * porque não existia login quando ela foi escrita — furo que ficou para
 * trás. `areasVisiveis`/`departamento` só fazem sentido junto com
 * autenticação: sem saber quem está pedindo, não há o que filtrar.
 */

export const dynamic = 'force-dynamic';

/**
 * As conversas que esta pessoa pode ver, prontas para o painel.
 *
 * Devolve também o departamento de quem pediu: o painel precisa dele para
 * saber qual das duas pontas de cada conversa é "o outro lado" a exibir (ver
 * `outroLado` em `PainelAudiovisual.tsx`).
 */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  return Response.json({
    conversas: await montarConversas(pessoa),
    meuDepartamento: pessoa.departamento ?? null,
  });
}

/** Envia uma mensagem numa conversa entre dois departamentos. */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  if (!pessoa.departamento) {
    return Response.json(
      { erro: 'Pessoa sem departamento atribuído.' },
      { status: 400 },
    );
  }

  // Aceita os dois formatos: JSON (recado só de texto) e multipart (recado
  // com imagem). O painel manda multipart quando há anexo — mesmo caminho de
  // `salvarImagem` que o link de área já usa.
  const ehFormulario = (request.headers.get('content-type') ?? '').includes(
    'multipart/form-data',
  );

  let conversaId: string;
  let texto: string;
  let prioridadePedida: unknown;
  let arquivos: File[] = [];

  if (ehFormulario) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
    }
    conversaId = String(form.get('conversaId') ?? '');
    texto = String(form.get('texto') ?? '').trim();
    prioridadePedida = form.get('prioridade');
    arquivos = form
      .getAll('imagens')
      .filter((v): v is File => v instanceof File && v.size > 0);
  } else {
    let corpo: { conversaId?: unknown; texto?: unknown; prioridade?: unknown };
    try {
      corpo = await request.json();
    } catch {
      return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
    }
    conversaId = String(corpo.conversaId ?? '');
    texto = String(corpo.texto ?? '').trim();
    prioridadePedida = corpo.prioridade;
  }

  const [deptoA, deptoB] = conversaId.split('__');
  if (!deptoA || !deptoB) {
    return Response.json({ erro: 'Conversa inválida.' }, { status: 400 });
  }

  // Duas condições: a conversa precisa ser minha (sou uma das pontas) e o
  // outro lado precisa estar liberado para mim pelo admin.
  const souPonta = pessoa.departamento === deptoA || pessoa.departamento === deptoB;
  const outro = pessoa.departamento === deptoA ? deptoB : deptoA;
  const liberados = podeConversarCom(
    pessoa,
    (await store.listarDepartamentos()).map((d) => d.slug),
  );

  if (!souPonta || !liberados.includes(outro)) {
    return Response.json(
      { erro: 'Você não pode conversar com este departamento.' },
      { status: 403 },
    );
  }

  // O client pode mandar 'urgente' mesmo numa conversa sem Audiovisual (ex:
  // UI desatualizada) — o servidor rebaixa para null em vez de rejeitar, já
  // que "normal" é sempre um valor válido e o pior caso de aceitar é a
  // mensagem perder um destaque que não faria sentido ali de qualquer forma.
  const prioridade: Prioridade | null =
    prioridadePedida === 'urgente' && conversaTemUrgencia(deptoA, deptoB)
      ? 'urgente'
      : null;

  // Um recado precisa dizer alguma coisa: texto, imagem, ou os dois.
  if (!texto && arquivos.length === 0) {
    return Response.json(
      { erro: 'Escreva a mensagem ou anexe uma imagem.' },
      { status: 400 },
    );
  }

  if (texto.length > TAMANHO_MAXIMO_TEXTO) {
    return Response.json(
      { erro: `A mensagem passa de ${TAMANHO_MAXIMO_TEXTO} caracteres.` },
      { status: 400 },
    );
  }

  if (arquivos.length > MAXIMO_ANEXOS) {
    return Response.json(
      { erro: `Envie no máximo ${MAXIMO_ANEXOS} imagens por recado.` },
      { status: 400 },
    );
  }

  const anexos: Omit<Anexo, 'id'>[] = [];
  for (const arquivo of arquivos) {
    try {
      anexos.push(await salvarImagem(arquivo));
    } catch (erro) {
      if (erro instanceof ErroDeUpload) {
        return Response.json({ erro: erro.message }, { status: 400 });
      }
      throw erro;
    }
  }

  const mensagem = await store.criarMensagem({
    conversaId,
    remetente: pessoa.departamento,
    // Quem escreveu, para o painel exibir "Departamento · Pessoa". Vem da
    // sessão, nunca do corpo da requisição: assinatura não se declara.
    autor: pessoa.nome,
    texto,
    prioridade,
    anexos,
  });

  publicar('mensagem-nova', conversaId);

  return Response.json({ mensagem }, { status: 201 });
}

import { separarChaveDeAcesso } from '@/lib/areas';
import { publicar } from '@/lib/eventos';
import { store } from '@/lib/store';
import { MAXIMO_ANEXOS, TAMANHO_MAXIMO_TEXTO } from '@/lib/limites';
import { ErroDeUpload, salvarImagem } from '@/lib/uploads';
import type { Anexo, Prioridade } from '@/lib/types';

/**
 * Envio e leitura de recados de uma área.
 *
 * O acesso é pela chave `{slug}-{token}` que vem na URL. É a única verificação
 * por enquanto: quem tem o link da Cantina envia como Cantina, e não alcança
 * as mensagens do Kids. Login entra depois sem mudar as telas.
 */

export const dynamic = 'force-dynamic';

/** Confere a chave da URL e devolve a área, ou null se não confere. */
async function areaDaChave(chave: string) {
  const partes = separarChaveDeAcesso(chave);
  if (!partes) return null;
  return store.autenticarArea(partes.slug, partes.token);
}

/** Conversa da área: o que ela mandou e o que o audiovisual respondeu. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chave: string }> },
) {
  const { chave } = await params;
  const area = await areaDaChave(chave);
  if (!area) {
    return Response.json({ erro: 'Link inválido.' }, { status: 404 });
  }

  const mensagens = await store.listarPorArea(area.slug);
  return Response.json({ area, mensagens });
}

/** Envia um recado novo para o audiovisual. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ chave: string }> },
) {
  const { chave } = await params;
  const area = await areaDaChave(chave);
  if (!area) {
    return Response.json({ erro: 'Link inválido.' }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const texto = String(form.get('texto') ?? '').trim();
  const prioridade: Prioridade =
    form.get('prioridade') === 'urgente' ? 'urgente' : 'normal';

  const arquivos = form
    .getAll('imagens')
    .filter((v): v is File => v instanceof File && v.size > 0);

  // Um recado precisa dizer alguma coisa: texto, imagem, ou os dois.
  if (!texto && arquivos.length === 0) {
    return Response.json(
      { erro: 'Escreva um recado ou anexe uma imagem.' },
      { status: 400 },
    );
  }

  if (texto.length > TAMANHO_MAXIMO_TEXTO) {
    return Response.json(
      { erro: `O recado passa de ${TAMANHO_MAXIMO_TEXTO} caracteres.` },
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
    areaSlug: area.slug,
    autor: 'area',
    texto,
    prioridade,
    anexos,
  });

  publicar('mensagem-nova', area.slug);

  return Response.json({ mensagem }, { status: 201 });
}

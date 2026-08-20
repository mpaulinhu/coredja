import { avisosStore } from '@/lib/avisos-store';
import { podeFazer } from '@/lib/papeis';
import { pessoaDaRequisicao } from '@/lib/sessao';
import { TAMANHO_MAXIMO_BYTES } from '@/lib/limites';
import { ErroDeUpload, salvarImagem } from '@/lib/uploads';
import type { ImagemDoAviso } from '@/lib/avisos';

export const dynamic = 'force-dynamic';

/** Todos os avisos cadastrados. Qualquer pessoa logada pode ver a lista. */
export async function GET(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const avisos = await avisosStore.listar();
  return Response.json({ avisos });
}

/** Aceita só o formato de data que o resto da plataforma usa (`culto.ts`). */
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Cadastra um aviso novo. Só quem tem `avisos:escrever` (líder).
 *
 * Chega como multipart (e não JSON) porque o aviso pode trazer uma arte
 * pronta para projetar — mesmo caminho dos anexos dos recados.
 */
export async function POST(request: Request) {
  const pessoa = await pessoaDaRequisicao(request);
  if (!pessoa) {
    return Response.json({ erro: 'Não autenticado.' }, { status: 401 });
  }
  if (!podeFazer(pessoa.papel, 'avisos:escrever')) {
    return Response.json(
      { erro: 'Seu papel não pode cadastrar avisos.' },
      { status: 403 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ erro: 'Envio inválido.' }, { status: 400 });
  }

  const titulo = String(form.get('titulo') ?? '').trim();
  const texto = String(form.get('texto') ?? '').trim();

  const arquivo = form.get('imagem');
  const temImagem = arquivo instanceof File && arquivo.size > 0;

  // A checagem que vale: a tela também barra, mas nada impede um envio
  // direto à rota. Um aviso sem título e sem imagem não teria o que mostrar.
  if (!titulo && !temImagem) {
    return Response.json(
      { erro: 'Informe o título do aviso ou anexe uma imagem.' },
      { status: 400 },
    );
  }

  const dias = lerDias(form.get('dias'));
  if (dias === null) {
    return Response.json({ erro: 'Datas inválidas.' }, { status: 400 });
  }

  let imagem: ImagemDoAviso | undefined;
  if (temImagem) {
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      const limite = Math.round(TAMANHO_MAXIMO_BYTES / (1024 * 1024));
      return Response.json(
        { erro: `Imagem muito grande. O limite é ${limite} MB.` },
        { status: 400 },
      );
    }
    try {
      imagem = await salvarImagem(arquivo);
    } catch (erro) {
      if (erro instanceof ErroDeUpload) {
        return Response.json({ erro: erro.message }, { status: 400 });
      }
      throw erro;
    }
  }

  const aviso = await avisosStore.criar(
    { titulo, texto, imagem, dias },
    pessoa.nome,
  );
  return Response.json({ aviso }, { status: 201 });
}

/**
 * Lê a lista de dias enviada como JSON dentro do multipart.
 * Devolve `null` quando o formato não confere — a rota responde 400.
 */
function lerDias(bruto: FormDataEntryValue | null): string[] | null {
  if (bruto === null || bruto === '') return [];

  let lista: unknown;
  try {
    lista = JSON.parse(String(bruto));
  } catch {
    return null;
  }

  if (!Array.isArray(lista)) return null;
  if (!lista.every((d) => typeof d === 'string' && FORMATO_DIA.test(d))) {
    return null;
  }

  // Ordenados e sem repetição: comparação de string basta no formato ISO.
  return [...new Set(lista as string[])].sort();
}

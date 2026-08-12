import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PASTA_UPLOADS } from '@/lib/uploads';

/**
 * Serve as imagens enviadas pelas áreas.
 *
 * As imagens ficam fora da pasta pública e passam por aqui para que o nome do
 * arquivo pedido seja validado antes de qualquer leitura em disco.
 */

const TIPOS_POR_EXTENSAO: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
};

/**
 * Só aceita exatamente o formato que `salvarImagem` gera: identificador
 * alfanumérico mais extensão conhecida. Qualquer nome com barra, ponto duplo
 * ou caractere fora disso é recusado antes de virar caminho de arquivo, o que
 * impede pedir algo como `../../dados/coredja.db`.
 */
const NOME_VALIDO = /^[A-Za-z0-9_-]{1,64}\.(jpg|png|webp|gif|heic)$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ arquivo: string }> },
) {
  const { arquivo } = await params;

  if (!NOME_VALIDO.test(arquivo)) {
    return new Response('Não encontrado', { status: 404 });
  }

  const caminho = path.join(PASTA_UPLOADS, arquivo);

  // Segunda barreira: mesmo validado, o caminho final tem de estar dentro da
  // pasta de uploads.
  const raiz = path.resolve(PASTA_UPLOADS);
  if (!path.resolve(caminho).startsWith(raiz + path.sep)) {
    return new Response('Não encontrado', { status: 404 });
  }

  if (!existsSync(caminho)) {
    return new Response('Não encontrado', { status: 404 });
  }

  const conteudo = await readFile(caminho);
  const tipo =
    TIPOS_POR_EXTENSAO[path.extname(arquivo).toLowerCase()] ??
    'application/octet-stream';

  return new Response(new Uint8Array(conteudo), {
    headers: {
      'Content-Type': tipo,
      // O nome contém um identificador único, então o conteúdo nunca muda:
      // o navegador pode guardar à vontade.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
    },
  });
}

import { nanoid } from 'nanoid';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TAMANHO_MAXIMO_BYTES } from './limites';
import type { Anexo } from './types';

/**
 * Recebimento das imagens enviadas pelas áreas (banners da cantina, fotos).
 *
 * Os arquivos vão para `dados/uploads/`, fora da pasta pública: são servidos
 * por uma rota que lê do disco, nunca como arquivo estático. Isso garante que
 * o que sai daqui seja sempre imagem, com o tipo que validamos na entrada.
 *
 * As imagens ficam no disco mesmo com os recados no Firestore: o Firebase
 * Storage exige o plano pago, e o disco local resolve sem custo. Quando isso
 * mudar, basta trocar a gravação aqui — o campo `url` de cada anexo já é
 * opaco para quem exibe.
 *
 * Só o servidor importa este arquivo. Os limites usados também pelas telas
 * ficam em `limites.ts`.
 */

/** Pasta onde ficam as imagens enviadas pelas áreas. */
export const PASTA_UPLOADS = path.join(process.cwd(), 'dados', 'uploads');

/**
 * Cria a pasta de imagens se ainda não existir.
 *
 * Fica aqui, e não no módulo do banco, porque as imagens são gravadas em
 * disco independentemente de onde os recados são guardados. Quando este
 * cuidado morava em `db.ts`, ligar o Firestore fazia a pasta nunca ser
 * criada e todo envio com imagem falhava.
 */
function garantirPasta(): void {
  if (!existsSync(PASTA_UPLOADS)) {
    mkdirSync(PASTA_UPLOADS, { recursive: true });
  }
}

/**
 * Formatos aceitos e sua extensão no disco.
 *
 * A extensão vem desta tabela, e não do nome enviado pelo celular: assim um
 * arquivo chamado "banner.jpg.exe" não vira um executável no disco.
 */
const TIPOS_ACEITOS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
};

/**
 * Assinaturas binárias dos formatos aceitos.
 *
 * O tipo declarado pelo navegador pode ser forjado; os primeiros bytes do
 * arquivo, não. Conferir os dois evita gravar um arquivo qualquer só porque
 * veio rotulado como imagem.
 */
function pareceImagem(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;

  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const gif =
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46; // "GIF"

  const texto = new TextDecoder('ascii').decode(bytes.slice(0, 12));
  const webp = texto.startsWith('RIFF') && texto.slice(8, 12) === 'WEBP';
  const heic = texto.slice(4, 8) === 'ftyp';

  return jpeg || png || gif || webp || heic;
}

export class ErroDeUpload extends Error {}

/** Deixa o nome original legível e seguro para exibir e baixar. */
function limparNome(nome: string): string {
  const base = path.basename(nome).replace(/[/\\]/g, '');
  const limpo = base.replace(/[\x00-\x1f<>:"|?*]/g, '').trim();
  return limpo.slice(0, 120) || 'imagem';
}

/**
 * Valida e grava uma imagem, devolvendo o anexo pronto para a mensagem.
 * Lança `ErroDeUpload` com mensagem em português para exibir na tela.
 */
export async function salvarImagem(arquivo: File): Promise<Omit<Anexo, 'id'>> {
  const extensao = TIPOS_ACEITOS[arquivo.type];
  if (!extensao) {
    throw new ErroDeUpload(
      'Formato não aceito. Envie uma imagem JPG, PNG, WEBP, GIF ou HEIC.',
    );
  }

  if (arquivo.size === 0) {
    throw new ErroDeUpload('O arquivo está vazio.');
  }

  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    const limite = Math.round(TAMANHO_MAXIMO_BYTES / (1024 * 1024));
    throw new ErroDeUpload(`Imagem muito grande. O limite é ${limite} MB.`);
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (!pareceImagem(bytes)) {
    throw new ErroDeUpload('O arquivo não parece ser uma imagem válida.');
  }

  garantirPasta();

  const id = nanoid();
  const nomeNoDisco = `${id}${extensao}`;

  // O turbopackIgnore evita que o build inclua o projeto inteiro na saída por
  // não conseguir provar o destino desta escrita. É seguro: a pasta é fixa e o
  // nome vem de nanoid mais uma extensão da tabela acima, nunca do enviado.
  await writeFile(
    path.join(/* turbopackIgnore: true */ PASTA_UPLOADS, nomeNoDisco),
    bytes,
  );

  return {
    nomeArquivo: limparNome(arquivo.name),
    tipo: arquivo.type,
    tamanho: arquivo.size,
    // Caminho relativo à rota que serve as imagens. Com Firebase, passa a ser
    // a URL do Storage — quem exibe continua apenas usando este campo.
    url: `/api/imagens/${nomeNoDisco}`,
  };
}

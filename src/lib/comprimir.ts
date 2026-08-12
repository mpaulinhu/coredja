'use client';

/**
 * Redução da imagem antes do envio, feita no próprio celular.
 *
 * Serve a dois propósitos. Primeiro, a foto de um celular moderno tem vários
 * megabytes e subir isso pelo Wi-Fi de uma igreja demora — reduzir antes faz o
 * recado chegar em segundos em vez de minutos. Segundo, quando a plataforma
 * está hospedada, a imagem é guardada dentro do próprio recado no Firestore,
 * que tem limite de 1 MB por documento.
 *
 * O redimensionamento usa o canvas do navegador: a imagem é desenhada num
 * tamanho menor e reexportada como JPEG. Preserva de sobra a legibilidade de
 * um banner projetado no telão.
 */

/** Maior lado da imagem depois de reduzida. */
const LADO_MAXIMO = 1600;

/** Alvo de tamanho final. Abaixo do limite de 1 MB do Firestore, com folga. */
const ALVO_BYTES = 600 * 1024;

/** Qualidades tentadas em ordem, até o resultado caber no alvo. */
const QUALIDADES = [0.82, 0.7, 0.6, 0.5, 0.4];

/**
 * Reduz uma imagem e devolve o arquivo pronto para envio.
 *
 * Se algo falhar (formato que o navegador não abre, canvas indisponível),
 * devolve o arquivo original — melhor enviar grande que não enviar.
 */
export async function comprimirImagem(arquivo: File): Promise<File> {
  // HEIC do iPhone costuma não ser decodificável pelo canvas; o servidor
  // aceita o formato, então vale mais enviar como está.
  if (arquivo.type === 'image/heic') return arquivo;

  try {
    const bitmap = await createImageBitmap(arquivo);

    const escala = Math.min(
      1,
      LADO_MAXIMO / Math.max(bitmap.width, bitmap.height),
    );
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;

    const ctx = canvas.getContext('2d');
    if (!ctx) return arquivo;

    // Fundo branco: um PNG com transparência viraria preto ao virar JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close();

    for (const qualidade of QUALIDADES) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', qualidade),
      );
      if (!blob) break;

      if (blob.size <= ALVO_BYTES || qualidade === QUALIDADES.at(-1)) {
        // Se nem assim ficou menor que o original, envia o original.
        if (blob.size >= arquivo.size) return arquivo;

        return new File([blob], trocarExtensao(arquivo.name), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
      }
    }

    return arquivo;
  } catch {
    return arquivo;
  }
}

/** Mantém o nome original legível, ajustando a extensão para o novo formato. */
function trocarExtensao(nome: string): string {
  const semExtensao = nome.replace(/\.[^./\\]+$/, '');
  return `${semExtensao || 'imagem'}.jpg`;
}

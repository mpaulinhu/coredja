/**
 * Onde as imagens enviadas pelas áreas ficam guardadas.
 *
 * Dois modos, escolhidos pelo mesmo `COREDJA_STORAGE` do resto:
 *
 * - **disco** (`sqlite`): grava em `dados/uploads/` e serve por uma rota. É o
 *   modo da instalação no PC do audiovisual.
 *
 * - **embutida** (`firebase`): guarda a imagem dentro do próprio recado, como
 *   data URI. Necessário quando a plataforma está hospedada — ali o disco do
 *   servidor é descartável e some sem aviso, junto com qualquer arquivo
 *   gravado nele.
 *
 * Embutir tem um teto: o Firestore aceita 1 MB por documento. Por isso a
 * imagem é reduzida no celular antes de subir (ver `comprimir.ts`), e o
 * servidor recusa o que ainda assim passar do limite, com uma mensagem que
 * explica o que fazer.
 *
 * Em ambos os modos o campo `url` do anexo é opaco para quem exibe: numa forma
 * é um caminho para a rota de imagens, na outra é a própria imagem.
 */

/** Limite do que cabe embutido, com folga para o resto do documento. */
export const LIMITE_EMBUTIDO_BYTES = 900 * 1024;

/** Se as imagens são embutidas no recado em vez de gravadas em disco. */
export function imagensEmbutidas(): boolean {
  const escolha = (process.env.COREDJA_STORAGE ?? 'sqlite').toLowerCase();
  return escolha === 'firebase' || escolha === 'firestore';
}

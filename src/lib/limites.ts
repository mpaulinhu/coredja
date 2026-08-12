/**
 * Limites de envio, compartilhados entre navegador e servidor.
 *
 * Ficam num arquivo próprio, sem nenhuma dependência, porque as telas precisam
 * conhecê-los para avisar antes do envio, e o servidor para validar de fato.
 * Importar isso de `uploads.ts` arrastaria o banco de dados para dentro do
 * pacote que roda no celular.
 *
 * A checagem no navegador é conveniência; a que vale é a do servidor.
 */

/** Bem acima de um banner comum, ainda pequeno para a rede local. */
export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024;

export const MAXIMO_ANEXOS = 4;

export const TAMANHO_MAXIMO_TEXTO = 2000;

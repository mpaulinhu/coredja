/*
 * Gera os ícones do manifest (192 e 512) em PNG, sem depender de canvas nem
 * de pacote externo — mesma abordagem de `gerar-icone.mjs` do Conector, e
 * mesma identidade: quadrado azul royal com um "C" branco.
 *
 * Rodar de novo só faz sentido se a identidade mudar:
 *     node scripts/gerar-icones-pwa.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const FUNDO = [0x2f, 0x5a, 0xa8]; // #2f5aa8, o mesmo azul do Conector
const LETRA = [0xff, 0xff, 0xff];

function desenhar(TAM) {
  const pixels = new Uint8Array(TAM * TAM * 4);
  for (let i = 0; i < TAM * TAM; i++) {
    pixels[i * 4] = FUNDO[0];
    pixels[i * 4 + 1] = FUNDO[1];
    pixels[i * 4 + 2] = FUNDO[2];
    pixels[i * 4 + 3] = 255;
  }

  // "C" geométrico: um anel com uma abertura de ~70° à direita. Raios um
  // pouco menores que os do ícone do Windows por causa do `maskable` do
  // manifest — o Android recorta as bordas em círculo, e um desenho que
  // encosta na margem sai cortado.
  const c = TAM / 2;
  const rExterno = TAM * 0.30;
  const rInterno = TAM * 0.175;
  for (let y = 0; y < TAM; y++) {
    for (let x = 0; x < TAM; x++) {
      const dx = x - c;
      const dy = y - c;
      const dist = Math.hypot(dx, dy);
      if (dist <= rInterno || dist >= rExterno) continue;
      const angulo = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angulo > -35 && angulo < 35) continue; // a abertura do C
      const i = (y * TAM + x) * 4;
      pixels[i] = LETRA[0];
      pixels[i + 1] = LETRA[1];
      pixels[i + 2] = LETRA[2];
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

function crc32(buf) {
  const tabela =
    crc32.tabela ||
    (crc32.tabela = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      return t;
    })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = tabela[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const tipoBuf = Buffer.from(tipo, 'ascii');
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tipoBuf, dados])), 0);
  return Buffer.concat([tamanho, tipoBuf, dados, crcBuf]);
}

function paraPng(pixels, TAM) {
  const linhas = Buffer.alloc(TAM * (1 + TAM * 4));
  for (let y = 0; y < TAM; y++) {
    const off = y * (1 + TAM * 4);
    linhas[off] = 0; // filtro None
    for (let x = 0; x < TAM * 4; x++) linhas[off + 1 + x] = pixels[y * TAM * 4 + x];
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(TAM, 0);
  ihdr.writeUInt32BE(TAM, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(linhas, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

for (const tam of [192, 512]) {
  const caminho = new URL(`../public/icone-${tam}.png`, import.meta.url);
  writeFileSync(caminho, paraPng(desenhar(tam), tam));
  console.log(`icone-${tam}.png gerado`);
}

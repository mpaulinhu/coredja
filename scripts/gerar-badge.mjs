/*
 * Gera `public/badge-96.png` — o ícone pequeno da barra de status do Android.
 *
 * ┌─ POR QUE UM ÍCONE SÓ PARA ISSO ────────────────────────────────────────┐
 * O Android renderiza o `badge` como SILHUETA: joga fora as cores e usa
 * apenas o canal alfa, pintando de branco tudo que for opaco. O ícone do
 * app é um quadrado azul cheio — opaco de ponta a ponta — então virava um
 * retângulo branco sólido na barrinha, sem desenho nenhum. Era o que se via
 * até 26/08/2026.
 *
 * A regra, então, é o oposto do ícone normal: fundo TRANSPARENTE, e só o
 * traço do "C" opaco. O Android pinta esse traço de branco e o resultado
 * fica legível.
 * └────────────────────────────────────────────────────────────────────────┘
 *
 *     node scripts/gerar-badge.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const TAM = 96;

function desenhar() {
  // Tudo começa transparente (alfa 0) — o inverso do ícone do app.
  const pixels = new Uint8Array(TAM * TAM * 4);

  const c = TAM / 2;
  // Traço mais grosso que o do ícone grande: em 24px na barra de status, um
  // anel fino some. A margem generosa evita o corte que alguns aparelhos
  // aplicam nas bordas.
  const rExterno = TAM * 0.42;
  const rInterno = TAM * 0.24;

  for (let y = 0; y < TAM; y++) {
    for (let x = 0; x < TAM; x++) {
      const dx = x - c;
      const dy = y - c;
      const dist = Math.hypot(dx, dy);
      if (dist <= rInterno || dist >= rExterno) continue;
      const angulo = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angulo > -38 && angulo < 38) continue; // a abertura do C

      const i = (y * TAM + x) * 4;
      // Branco opaco. A cor não importa (o Android descarta e repinta), mas
      // branco mantém o arquivo coerente se algum lugar exibir como está.
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
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

const pixels = desenhar();
const linhas = Buffer.alloc(TAM * (1 + TAM * 4));
for (let y = 0; y < TAM; y++) {
  const off = y * (1 + TAM * 4);
  linhas[off] = 0;
  for (let x = 0; x < TAM * 4; x++) linhas[off + 1 + x] = pixels[y * TAM * 4 + x];
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(TAM, 0);
ihdr.writeUInt32BE(TAM, 4);
ihdr[8] = 8;
ihdr[9] = 6; // RGBA — o alfa é o que interessa aqui
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  bloco('IHDR', ihdr),
  bloco('IDAT', deflateSync(linhas, { level: 9 })),
  bloco('IEND', Buffer.alloc(0)),
]);

writeFileSync(new URL('../public/badge-96.png', import.meta.url), png);
console.log('badge-96.png gerado');

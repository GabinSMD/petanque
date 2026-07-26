/**
 * Génère les icônes PWA (PNG) sans dépendance : une boule de pétanque
 * et son cochonnet sur fond vert. Usage : node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'client', 'public');
mkdirSync(outDir, { recursive: true });

/* ----------------------------- Encodeur PNG ----------------------------- */

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtre « aucun »
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------- Dessin -------------------------------- */

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const BG = hex('#1d3d9c');
const STEEL = hex('#d8dde2');
const STEEL_DARK = hex('#8b969f');
const RIM = hex('#4a545e');
const COCHONNET = hex('#d21c34');
const COCHONNET_RIM = hex('#7c1220');

function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.33;
  const jx = size * 0.72;
  const jy = size * 0.73;
  const jr = size * 0.1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = BG;
      const db = Math.hypot(x - cx, y - cy);
      const dj = Math.hypot(x - jx, y - jy);

      if (db <= r) {
        // Boule acier, éclairée en haut à gauche.
        const light = Math.hypot(x - (cx - r * 0.45), y - (cy - r * 0.45)) / (2 * r);
        const t = Math.min(1, light);
        color = STEEL.map((c, i) => Math.round(c + (STEEL_DARK[i] - c) * t));
        // Stries horizontales.
        const dy = Math.abs(y - cy);
        const band = size * 0.115;
        if (Math.abs(dy - band) < size * 0.014) color = RIM;
        // Liseré.
        if (db >= r - size * 0.02) color = RIM;
      }
      if (dj <= jr) {
        color = dj >= jr - size * 0.018 ? COCHONNET_RIM : COCHONNET;
      }

      const o = (y * size + x) * 4;
      px[o] = color[0];
      px[o + 1] = color[1];
      px[o + 2] = color[2];
      px[o + 3] = 255;
    }
  }
  return px;
}

for (const size of [192, 512]) {
  const file = join(outDir, `pwa-${size}.png`);
  writeFileSync(file, encodePng(size, draw(size)));
  console.log(`✔ ${file}`);
}

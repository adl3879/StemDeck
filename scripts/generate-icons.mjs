// Generates public/icon-96.png and public/icon-512.png for Media Session artwork.
// iOS ignores SVG artwork, so we rasterize a minimal icon (iris play triangle
// on the app's dark surface color) with no external dependencies.
//
// Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [0x1e, 0x1c, 0x26]; // --surface (dark)
const FG = [0x8c, 0x7c, 0xff]; // --iris

function renderIcon(size) {
  const rgba = new Uint8Array(size * size * 4);
  const SS = 4; // supersampling for anti-aliasing
  const radius = size * 0.24;
  const half = size / 2;
  const pA = { x: -0.30 * size, y: -0.40 * size };
  const pB = { x: -0.30 * size, y: 0.4 * size };
  const pC = { x: 0.44 * size, y: 0 };

  const sign = (x1, y1, x2, y2, x3, y3) =>
    (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const inTriangle = (px, py) => {
    const d1 = sign(px, py, pA.x, pA.y, pB.x, pB.y);
    const d2 = sign(px, py, pB.x, pB.y, pC.x, pC.y);
    const d3 = sign(px, py, pC.x, pC.y, pA.x, pA.y);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgCount = 0;
      let fgCount = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const dx = Math.max(Math.abs(px - half) - (half - radius), 0);
          const dy = Math.max(Math.abs(py - half) - (half - radius), 0);
          if (dx * dx + dy * dy > radius * radius) continue; // outside rounded square
          bgCount++;
          if (inTriangle(px, py)) fgCount++;
        }
      }
      const total = SS * SS;
      const i = (y * size + x) * 4;
      const f = bgCount === 0 ? 0 : fgCount / bgCount;
      rgba[i] = Math.round(BG[0] * (1 - f) + FG[0] * f);
      rgba[i + 1] = Math.round(BG[1] * (1 - f) + FG[1] * f);
      rgba[i + 2] = Math.round(BG[2] * (1 - f) + FG[2] * f);
      rgba[i + 3] = Math.round((bgCount / total) * 255);
    }
  }
  return encodePNG(size, size, rgba);
}

writeFileSync(join(ROOT, "public", "icon-96.png"), renderIcon(96));
writeFileSync(join(ROOT, "public", "icon-512.png"), renderIcon(512));
console.log("Wrote public/icon-96.png and public/icon-512.png");

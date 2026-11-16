// 占位封面生成器（零依赖，纯 Node 编码 PNG）
// 用法: node scripts/gen-cover.js  → 输出到 scripts/assets/
// 说明: 图片上传功能属 admin 模块（M4），此前用品牌色占位图保证验收观感
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 600;

// --- 最小 PNG 编码器（RGB 8bit） ---
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
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

function encodePng(pixels, width, height) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    pixels.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// --- 绘制：垂直渐变 + 两个半透明圆（视觉占位） ---
function draw(top, bottom, circles) {
  const px = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) {
    const t = y / (SIZE - 1);
    const r = Math.round(top[0] + (bottom[0] - top[0]) * t);
    const g = Math.round(top[1] + (bottom[1] - top[1]) * t);
    const b = Math.round(top[2] + (bottom[2] - top[2]) * t);
    for (let x = 0; x < SIZE; x++) {
      let cr = r, cg = g, cb = b;
      for (const c of circles) {
        const d = Math.hypot(x - c.x, y - c.y);
        if (d < c.r) {
          const a = c.alpha * (1 - d / c.r);
          cr = Math.round(cr * (1 - a) + 255 * a);
          cg = Math.round(cg * (1 - a) + 255 * a);
          cb = Math.round(cb * (1 - a) + 255 * a);
        }
      }
      const i = (y * SIZE + x) * 3;
      px[i] = cr; px[i + 1] = cg; px[i + 2] = cb;
    }
  }
  return encodePng(px, SIZE, SIZE);
}

const outDir = path.join(__dirname, 'assets');
fs.mkdirSync(outDir, { recursive: true });

// 实物：品牌蓝渐变（design-tokens #2E6BE6）
fs.writeFileSync(
  path.join(outDir, 'cover-physical.png'),
  draw([0x2e, 0x6b, 0xe6], [0x6f, 0x9d, 0xf2], [
    { x: 460, y: 150, r: 170, alpha: 0.28 },
    { x: 140, y: 470, r: 230, alpha: 0.2 }
  ])
);

// 虚拟：活力橙渐变（design-tokens #FF8F1F）
fs.writeFileSync(
  path.join(outDir, 'cover-virtual.png'),
  draw([0xff, 0x8f, 0x1f], [0xff, 0xc4, 0x80], [
    { x: 150, y: 160, r: 180, alpha: 0.25 },
    { x: 470, y: 480, r: 210, alpha: 0.2 }
  ])
);

console.log('covers written to', outDir);

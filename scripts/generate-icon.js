const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outDir = path.join(__dirname, '..', 'build');
const iconsetDir = path.join(outDir, 'icon.iconset');
fs.mkdirSync(iconsetDir, { recursive: true });

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0);
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(rgba, width, height) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(Buffer.from([0]));
    rows.push(rgba.subarray(y * width * 4, (y + 1) * width * 4));
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function drawIcon(size) {
  const data = Buffer.alloc(size * size * 4);
  const scale = size / 1024;

  function set(x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const index = (y * size + x) * 4;
    data[index] = clamp(r);
    data[index + 1] = clamp(g);
    data[index + 2] = clamp(b);
    data[index + 3] = clamp(a);
  }

  function blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= size || y >= size || a <= 0) return;
    const index = (y * size + x) * 4;
    const alpha = a / 255;
    data[index] = clamp(r * alpha + data[index] * (1 - alpha));
    data[index + 1] = clamp(g * alpha + data[index + 1] * (1 - alpha));
    data[index + 2] = clamp(b * alpha + data[index + 2] * (1 - alpha));
    data[index + 3] = clamp(255 * alpha + data[index + 3] * (1 - alpha));
  }

  function roundedAlpha(x, y) {
    const margin = 64 * scale;
    const radius = 64 * scale;
    const dx = x < margin ? margin - x : x >= size - margin ? x - (size - margin - 1) : 0;
    const dy = y < margin ? margin - y : y >= size - margin ? y - (size - margin - 1) : 0;
    const distance = Math.hypot(dx, dy);
    if (distance <= radius) return 1;
    if (distance > radius + 3 * scale) return 0;
    return 1 - (distance - radius) / (3 * scale);
  }

  function line(x0, y0, x1, y1, width, color) {
    const [r, g, b, a] = color;
    x0 *= scale; y0 *= scale; x1 *= scale; y1 *= scale; width *= scale;
    const minX = Math.floor(Math.min(x0, x1) - width);
    const maxX = Math.ceil(Math.max(x0, x1) + width);
    const minY = Math.floor(Math.min(y0, y1) - width);
    const maxY = Math.ceil(Math.max(y0, y1) + width);
    const vx = x1 - x0;
    const vy = y1 - y0;
    const lengthSquared = vx * vx + vy * vy;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / lengthSquared));
        const px = x0 + vx * t;
        const py = y0 + vy * t;
        const distance = Math.hypot(x - px, y - py);
        if (distance <= width) blend(x, y, r, g, b, (1 - distance / width) * a);
      }
    }
  }

  function roundRect(x0, y0, width, height, radius, color) {
    const [r, g, b, a] = color;
    x0 *= scale; y0 *= scale; width *= scale; height *= scale; radius *= scale;
    for (let y = Math.floor(y0); y < y0 + height; y += 1) {
      for (let x = Math.floor(x0); x < x0 + width; x += 1) {
        const dx = x < x0 + radius ? x0 + radius - x : x > x0 + width - radius ? x - (x0 + width - radius) : 0;
        const dy = y < y0 + radius ? y0 + radius - y : y > y0 + height - radius ? y - (y0 + height - radius) : 0;
        if (Math.hypot(dx, dy) <= radius) blend(x, y, r, g, b, a);
      }
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const alpha = roundedAlpha(x, y);
      let r = mix(16, 34, u * 0.5 + v * 0.2);
      let g = mix(18, 45, u * 0.35 + v * 0.35);
      let b = mix(24, 58, u * 0.2 + v * 0.65);
      const glowA = Math.max(0, 1 - Math.hypot(u - 0.66, v - 0.34) / 0.42);
      const glowB = Math.max(0, 1 - Math.hypot(u - 0.3, v - 0.72) / 0.46);
      r += glowA * 22 + glowB * 6;
      g += glowA * 72 + glowB * 32;
      b += glowA * 92 + glowB * 82;
      set(x, y, r, g, b, alpha * 255);
    }
  }

  roundRect(206, 254, 612, 516, 54, [255, 255, 255, 20]);
  roundRect(236, 290, 552, 452, 42, [5, 8, 13, 70]);
  for (let i = 0; i < 34; i += 1) {
    const x = 286 + i * 14;
    const amp = 70 + Math.sin(i * 0.65) * 92 + Math.sin(i * 1.7) * 34;
    const height = Math.max(28, Math.abs(amp));
    const t = i / 33;
    line(x, 512 - height / 2, x, 512 + height / 2, 4.8, [mix(126, 111, t), mix(220, 231, t), mix(255, 189, t), 230]);
  }
  line(254, 512, 770, 512, 2.2, [255, 255, 255, 70]);
  line(644, 298, 644, 726, 7, [119, 226, 255, 210]);
  roundRect(330, 206, 372, 68, 30, [255, 255, 255, 26]);
  roundRect(362, 222, 308, 30, 15, [118, 231, 189, 120]);

  return encodePng(data, size, size);
}

function writeIco(images, target) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = [];
  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry[0] = image.size >= 256 ? 0 : image.size;
    entry[1] = image.size >= 256 ? 0 : image.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.buffer.length;
    entries.push(entry);
  }
  fs.writeFileSync(target, Buffer.concat([header, ...entries, ...images.map((image) => image.buffer)]));
}

function writeIcns(images, target) {
  const chunks = images.map((image) => {
    const type = Buffer.from(image.type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(image.buffer.length + 8);
    return Buffer.concat([type, length, image.buffer]);
  });
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 8);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(totalLength, 4);
  fs.writeFileSync(target, Buffer.concat([header, ...chunks]));
}

const iconset = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
];

for (const [name, size] of iconset) {
  fs.writeFileSync(path.join(iconsetDir, name), drawIcon(size));
}
fs.writeFileSync(path.join(outDir, 'icon.png'), drawIcon(1024));
writeIco([16, 32, 48, 64, 128, 256].map((size) => ({ size, buffer: drawIcon(size) })), path.join(outDir, 'icon.ico'));
writeIcns([
  { type: 'ic07', buffer: drawIcon(128) },
  { type: 'ic08', buffer: drawIcon(256) },
  { type: 'ic09', buffer: drawIcon(512) },
  { type: 'ic10', buffer: drawIcon(1024) },
  { type: 'ic11', buffer: drawIcon(32) },
  { type: 'ic12', buffer: drawIcon(64) },
  { type: 'ic13', buffer: drawIcon(256) },
  { type: 'ic14', buffer: drawIcon(512) }
], path.join(outDir, 'icon.icns'));

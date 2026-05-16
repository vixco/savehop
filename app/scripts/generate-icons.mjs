#!/usr/bin/env node
// Generates Tauri bundle icons from a generated SVG.
// Idempotent — skips if icons already exist.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'src-tauri', 'icons');
const required = [
  '32x32.png',
  '128x128.png',
  '128x128@2x.png',
  'icon.icns',
  'icon.ico',
];

if (required.every((f) => existsSync(join(iconsDir, f)))) {
  console.log('[icons] all present, skipping');
  process.exit(0);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('[icons] sharp is not installed. Run: npm install --no-save sharp');
  process.exit(1);
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f1117"/>
      <stop offset="1" stop-color="#161924"/>
    </linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22d3b8"/>
      <stop offset="1" stop-color="#1a9d8a"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
  <rect x="80" y="80" width="864" height="864" rx="180" fill="none" stroke="url(#acc)" stroke-width="12" opacity="0.35"/>
  <text x="512" y="700" font-family="'Space Mono','SF Mono',monospace" font-weight="700" font-size="680"
    text-anchor="middle" fill="url(#acc)">S</text>
</svg>`;

mkdirSync(iconsDir, { recursive: true });
const buf = Buffer.from(svg);

async function png(size, name) {
  const out = await sharp(buf).resize(size, size).png().toBuffer();
  writeFileSync(join(iconsDir, name), out);
  console.log('[icons] wrote', name);
}

await png(32, '32x32.png');
await png(128, '128x128.png');
await png(256, '128x128@2x.png');
await png(512, 'icon.png');
await png(30, 'Square30x30Logo.png');
await png(44, 'Square44x44Logo.png');
await png(71, 'Square71x71Logo.png');
await png(89, 'Square89x89Logo.png');
await png(107, 'Square107x107Logo.png');
await png(142, 'Square142x142Logo.png');
await png(150, 'Square150x150Logo.png');
await png(284, 'Square284x284Logo.png');
await png(310, 'Square310x310Logo.png');
await png(50, 'StoreLogo.png');

// .ico — multi-size
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icoBuffers = await Promise.all(
  icoSizes.map((s) => sharp(buf).resize(s, s).png().toBuffer()),
);
writeFileSync(join(iconsDir, 'icon.ico'), buildIco(icoSizes, icoBuffers));
console.log('[icons] wrote icon.ico');

// .icns is macOS-only and not needed for Windows builds.
// Write a stub png-as-icns to satisfy tauri.conf icon list on non-mac builds.
writeFileSync(join(iconsDir, 'icon.icns'), await sharp(buf).resize(512, 512).png().toBuffer());
console.log('[icons] wrote icon.icns (stub)');

function buildIco(sizes, buffers) {
  // ICONDIR (6 bytes) + ICONDIRENTRY * n (16 bytes each) + image data
  const headerSize = 6 + 16 * sizes.length;
  let offset = headerSize;
  const entries = [];
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const data = buffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // offset
    entries.push({ entry, data });
    offset += data.length;
  }
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(sizes.length, 4); // count
  return Buffer.concat([dir, ...entries.map((e) => e.entry), ...entries.map((e) => e.data)]);
}

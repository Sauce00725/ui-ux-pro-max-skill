// Renders the app icon and splash screen from the game's own art, using the
// Playwright Chromium already used for testing. Output goes to resources/.
// The App Store requires an opaque 1024×1024 icon with no rounded corners.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Resolved with require so a globally installed Playwright also works.
const { chromium } = createRequire(import.meta.url)('playwright');
const res = join(here, 'resources');
mkdirSync(res, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(join(here, '..', 'index.html')).href);
await page.waitForFunction(() => window.__aow);

const shots = await page.evaluate(() => {
  const A = window.__aow;
  const spartan = A.DEFS.find((d) => d.id === 'spartan');
  const grey = A.DEFS.find((d) => d.id === 'grey');
  const make = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), c); return c.toDataURL('image/png'); };
  const warrior = (def, size) => { const c = document.createElement('canvas'); c.width = size; c.height = size; A.drawPortrait(c, def); return c; };
  const backdrop = (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2a1a10'); bg.addColorStop(0.55, '#8a4a24'); bg.addColorStop(1, '#15110c');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const sun = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.42);
    sun.addColorStop(0, 'rgba(255,214,140,.85)'); sun.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
  };
  // Icons come back as raw RGBA so Node can write them without an alpha channel.
  const rawOf = (url, n) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.drawImage(img, 0, 0); res(Array.from(g.getImageData(0, 0, n, n).data)); };
    img.src = url;
  });
  const icon = (n) => make(n, n, (g) => {
    backdrop(g, n, n);
    const s = warrior(spartan, n);
    g.globalCompositeOperation = 'source-over';
    // The portrait has its own backdrop; draw it as a circular medallion.
    g.save(); g.beginPath(); g.arc(n / 2, n * 0.52, n * 0.4, 0, Math.PI * 2); g.clip();
    g.drawImage(s, n * 0.1, n * 0.12, n * 0.8, n * 0.8); g.restore();
    g.strokeStyle = '#d9a944'; g.lineWidth = n * 0.03;
    g.beginPath(); g.arc(n / 2, n * 0.52, n * 0.4, 0, Math.PI * 2); g.stroke();
  });
  const splash = make(2732, 2732, (g) => {
    g.fillStyle = '#15110c'; g.fillRect(0, 0, 2732, 2732);
    const glow = g.createRadialGradient(1366, 1200, 0, 1366, 1200, 900);
    glow.addColorStop(0, 'rgba(217,169,68,.35)'); glow.addColorStop(1, 'rgba(217,169,68,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 2732, 2732);
    g.drawImage(warrior(spartan, 700), 700, 900, 640, 640);
    g.drawImage(warrior(grey, 700), 1400, 900, 640, 640);
    g.fillStyle = '#efe4cf'; g.textAlign = 'center';
    g.font = '600 220px Teko, "Arial Narrow", sans-serif';
    g.fillText('DAWN OF WAR', 1366, 1800);
  });
  return Promise.all([rawOf(icon(1024), 1024), rawOf(icon(512), 512), rawOf(icon(180), 180)]).then(([i1024, i512, i180]) => ({ i1024, i512, i180, splash }));
});

// Minimal PNG writer: 8-bit RGB, no alpha (the App Store rejects icons with alpha).
function pngRGB(rgba, n) {
  const row = n * 3 + 1;
  const raw = Buffer.alloc(row * n);
  for (let y = 0; y < n; y++) {
    raw[y * row] = 0;
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4, o = y * row + 1 + x * 3;
      raw[o] = rgba[i]; raw[o + 1] = rgba[i + 1]; raw[o + 2] = rgba[i + 2];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const save = (name, dataUrl) => writeFileSync(join(res, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
// icon-only.png and splash.png are the names @capacitor/assets reads to make every native size.
writeFileSync(join(res, 'icon-only.png'), pngRGB(shots.i1024, 1024));
writeFileSync(join(res, 'icon-512.png'), pngRGB(shots.i512, 512));
writeFileSync(join(res, 'icon-180.png'), pngRGB(shots.i180, 180));
save('splash.png', shots.splash);
for (const old of ['icon-1024.png', 'splash-2732.png', 'splash-dark.png']) rmSync(join(res, old), { force: true });
await browser.close();
console.log(`Wrote icons and splash to ${res}`);

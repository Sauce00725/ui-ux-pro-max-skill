// Builds the standalone app page into www/ for Capacitor (iOS/Android) or any
// static host. The game's index.html is written for the artifact host, which
// supplies the document head; this script adds a full head with mobile meta.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const game = join(here, '..');
const out = join(here, 'www');
mkdirSync(out, { recursive: true });

const page = readFileSync(join(game, 'index.html'), 'utf8');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#15110c">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="format-detection" content="telephone=no">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-512.png">
<style>
  /* The base the artifact host normally provides: safe-area padding and a light reset. */
  html { box-sizing: border-box; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
  body { margin: 0; }
  img { max-width: 100%; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
${page}
</body>
</html>
`;
writeFileSync(join(out, 'index.html'), html);
for (const f of ['data.js', 'game.js']) copyFileSync(join(game, f), join(out, f));

const res = join(here, 'resources');
for (const f of ['icon-180.png', 'icon-512.png', 'icon-only.png']) {
  if (existsSync(join(res, f))) copyFileSync(join(res, f), join(out, f));
}
writeFileSync(join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Age of Warriors',
  short_name: 'Warriors',
  start_url: './',
  display: 'fullscreen',
  orientation: 'landscape',
  background_color: '#15110c',
  theme_color: '#15110c',
  icons: [
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-only.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
  ],
}, null, 2));
console.log(`Built ${out}`);

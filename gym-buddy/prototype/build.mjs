#!/usr/bin/env node
/*
 * Builds the clickable prototype: one self-contained HTML file that runs the
 * real Gym Buddy components, styles and motion against an in-memory demo
 * backend. No Supabase, no server.
 *
 *   npm run prototype            → prototype/dist/index.html (open it in a browser)
 *   npm run prototype -- --fonts → also embeds Saira and JetBrains Mono (needs a prior `next build`)
 *   npm run prototype -- --dev   → React's development build, unminified: shows React's warnings
 *
 * How the real code runs without its backend: esbuild swaps the modules that
 * talk to Next or Supabase (next/link, next/navigation, the server actions and
 * the browser Supabase client) for the stand-ins in prototype/src/stubs, which
 * read and write prototype/src/demo/world.ts. Everything else is imported
 * straight from src/.
 */
import { build } from 'esbuild'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SRC = path.join(ROOT, 'src')
const STUBS = path.join(HERE, 'src', 'stubs')

const SWAPS = new Map(
  [
    ['app/(app)/discover/actions', 'discover-actions.ts'],
    ['app/(app)/matches/actions', 'matches-actions.ts'],
    ['app/(app)/events/actions', 'events-actions.ts'],
    ['app/(app)/settings/actions', 'settings-actions.ts'],
    ['app/(auth)/actions', 'auth-actions.ts'],
    ['app/actions/translate', 'translate-action.ts'],
    ['lib/supabase/client', 'supabase-client.ts'],
  ].map(([from, to]) => [path.join(SRC, from), path.join(STUBS, to)]),
)

/** Swap Next and Supabase for the prototype's stand-ins, wherever they're imported from. */
const stubs = {
  name: 'prototype-stubs',
  setup(b) {
    b.onResolve({ filter: /^next\/(link|navigation)$/ }, (a) => ({
      path: path.join(STUBS, a.path === 'next/link' ? 'link.tsx' : 'navigation.tsx'),
    }))
    b.onResolve({ filter: /^(\.|@\/)/ }, async (a) => {
      if (a.pluginData?.skip) return
      const r = await b.resolve(a.path, { resolveDir: a.resolveDir, kind: a.kind, importer: a.importer, pluginData: { skip: true } })
      if (r.errors.length) return r
      const swap = SWAPS.get(r.path.replace(/\.(tsx?|jsx?)$/, ''))
      return swap ? { path: swap } : r
    })
  },
}

async function script({ dev = false } = {}) {
  const out = await build({
    entryPoints: [path.join(HERE, 'src', 'main.tsx')],
    tsconfig: path.join(HERE, 'tsconfig.json'),
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    minify: !dev,
    legalComments: 'none',
    define: { 'process.env.NODE_ENV': dev ? '"development"' : '"production"' },
    plugins: [stubs],
    logLevel: 'error', // 'use client' directives are noise here
  })
  // A literal </script> inside the bundle would end the inline tag early.
  return out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
}

async function styles() {
  process.env.NODE_ENV = 'production'
  const from = path.join(HERE, 'src', 'proto.css')
  const result = await postcss([tailwind({ base: ROOT })]).process(await readFile(from, 'utf8'), { from, to: undefined })
  return result.css
}

/** The latin faces from a production build, as data: URIs (the prototype then works offline). */
async function embeddedFonts() {
  const media = path.join(ROOT, '.next', 'static', 'media')
  const css = await readdir(path.join(ROOT, '.next', 'static', 'css')).then((f) => f.filter((n) => n.endsWith('.css')))
  const faces = []
  for (const file of css) {
    const text = await readFile(path.join(ROOT, '.next', 'static', 'css', file), 'utf8')
    for (const [rule] of text.matchAll(/@font-face\{[^}]*\}/g)) {
      // Only the latin subset: it's the one whose range covers plain text (u+00??).
      if (!/(Saira|JetBrains Mono)/.test(rule) || !/unicode-range:u\+00\?\?/i.test(rule)) continue
      const url = /url\(\/_next\/static\/media\/([^)]+)\)/.exec(rule)?.[1]
      if (!url) continue
      const data = (await readFile(path.join(media, url))).toString('base64')
      faces.push(rule.replace(/url\([^)]+\)/, `url(data:font/woff2;base64,${data})`).replace(/unicode-range:[^;}]+/, ''))
    }
  }
  if (!faces.length) throw new Error('No fonts found: run `next build` first (`next dev` replaces those files), or leave out --fonts.')
  return faces.join('\n')
}

const GOOGLE_FONTS =
  'https://fonts.googleapis.com/css2?family=Saira:ital,wdth,wght@0,50..125,100..900;1,50..125,100..900&family=JetBrains+Mono:wght@400;500;700&display=swap'

export async function buildParts({ fonts = false, dev = false } = {}) {
  const [js, css, fontFaces] = await Promise.all([script({ dev }), styles(), fonts ? embeddedFonts() : Promise.resolve('')])
  return { js, css: fontFaces + css, fontLink: fonts ? null : GOOGLE_FONTS }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dev = process.argv.includes('--dev')
  const { js, css, fontLink } = await buildParts({ fonts: process.argv.includes('--fonts'), dev })
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0a0b">
<title>Gym Buddy</title>
${fontLink ? `<link rel="stylesheet" href="${fontLink}">` : ''}
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`
  await mkdir(path.join(HERE, 'dist'), { recursive: true })
  const file = path.join(HERE, 'dist', dev ? 'dev.html' : 'index.html')
  await writeFile(file, html)
  console.log(`prototype/dist/${dev ? 'dev' : 'index'}.html  ${(html.length / 1024).toFixed(0)} KB  (js ${(js.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB)`)
}

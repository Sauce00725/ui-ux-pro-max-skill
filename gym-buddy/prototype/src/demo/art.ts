/*
 * Stand-in "photos", drawn as SVG so the prototype ships no image files: a mood
 * (gym light, studio, neon, track, golden hour, dusk), out-of-focus lights, a
 * motif that hints at the activity, and a soft figure with a rim light. Seeded,
 * so the same person always gets the same picture.
 */

export type Motif = 'lift' | 'run' | 'climb' | 'yoga' | 'court' | 'bike' | 'swim'

interface Mood {
  dark: string
  mid: string
  light: string
}

const MOODS: Mood[] = [
  { dark: '#20120c', mid: '#c4703c', light: '#ffbe78' }, // warm gym
  { dark: '#0a1220', mid: '#286eaa', light: '#96dcff' }, // cool studio
  { dark: '#160a1c', mid: '#963c8c', light: '#ff96d2' }, // neon
  { dark: '#0e1410', mid: '#50825a', light: '#d2f0be' }, // track
  { dark: '#1a1408', mid: '#b8902a', light: '#ffe49a' }, // golden hour
  { dark: '#101018', mid: '#5a4fb0', light: '#c9bfff' }, // dusk
]

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const f = (n: number) => n.toFixed(1)

function motifLayer(motif: Motif, light: string, r: () => number): string {
  switch (motif) {
    case 'lift':
      return `<g fill="${light}" opacity=".22"><rect x="70" y="250" width="44" height="230" rx="12"/><rect x="126" y="290" width="30" height="150" rx="10"/><rect x="606" y="250" width="44" height="230" rx="12"/><rect x="564" y="290" width="30" height="150" rx="10"/><rect x="0" y="358" width="720" height="14"/></g>`
    case 'run':
      return `<g opacity=".3"><circle cx="540" cy="470" r="150" fill="${light}"/></g><g stroke="${light}" stroke-width="5" opacity=".25"><path d="M0 700H720"/><path d="M0 760H720" opacity=".6"/><path d="M-40 1000L330 700M120 1000L400 700M300 1000L470 700"/></g>`
    case 'climb': {
      let holds = ''
      for (let i = 0; i < 26; i++) holds += `<rect x="${f(r() * 660)}" y="${f(r() * 900)}" width="${f(26 + r() * 40)}" height="${f(18 + r() * 26)}" rx="12"/>`
      return `<g fill="${light}" opacity=".2">${holds}</g>`
    }
    case 'yoga':
      return `<g fill="none" stroke="${light}" opacity=".3" stroke-width="6"><circle cx="360" cy="440" r="270"/><circle cx="360" cy="440" r="190" opacity=".6"/></g>`
    case 'court':
      return `<g stroke="${light}" stroke-width="6" opacity=".28" fill="none"><path d="M60 1080L250 640H470L660 1080"/><path d="M250 640H470"/><path d="M0 560H720" stroke-dasharray="14 12"/></g>`
    case 'bike':
      return `<g fill="none" stroke="${light}" stroke-width="10" opacity=".22"><circle cx="150" cy="800" r="150"/><circle cx="570" cy="800" r="150"/><path d="M150 800L300 600H430L570 800M300 600L360 800"/></g>`
    case 'swim':
      return `<g fill="none" stroke="${light}" stroke-width="6" opacity=".3"><path d="M-20 660Q90 600 200 660T420 660T640 660T860 660"/><path d="M-20 740Q90 680 200 740T420 740T640 740T860 740" opacity=".7"/><path d="M-20 820Q90 760 200 820T420 820T640 820T860 820" opacity=".45"/></g>`
  }
}

/** A data: URI the browser can draw as an <img>. Memoised: every card asks for the same picture many times. */
const cache = new Map<string, string>()

export function photo(seed: number, motif: Motif = 'lift', moodIndex = seed): string {
  const key = `${seed}/${motif}/${moodIndex}`
  const hit = cache.get(key)
  if (hit) return hit

  const r = rng(seed * 7919 + 13)
  const { dark, mid, light } = MOODS[Math.abs(moodIndex) % MOODS.length]

  let bokeh = ''
  for (let i = 0; i < 20; i++) {
    bokeh += `<circle cx="${f(r() * 720)}" cy="${f(r() * 640)}" r="${f(16 + r() * 56)}" fill-opacity="${f(0.1 + r() * 0.3).replace(/^0\./, '.')}"/>`
  }

  const cx = 360 + (r() - 0.5) * 120
  const spread = 0.92 + r() * 0.22
  const tilt = (r() - 0.5) * 10
  const sw = 250 * spread
  const body = `M${f(cx - sw)} 1100C${f(cx - sw)} 780 ${f(cx - sw * 0.6)} 650 ${f(cx)} 650C${f(cx + sw * 0.6)} 650 ${f(cx + sw)} 780 ${f(cx + sw)} 1100Z`
  const figure = `<g transform="rotate(${f(tilt)} ${f(cx)} 700)"><path d="${body}"/><rect x="${f(cx - 44)}" y="470" width="88" height="200" rx="40"/><ellipse cx="${f(cx)}" cy="400" rx="94" ry="112"/></g>`
  const rim = `<g fill="none" stroke="${light}" stroke-width="7" stroke-linecap="round" opacity=".6"><path transform="rotate(${f(tilt)} ${f(cx)} 700)" d="M${f(cx - 96)} 380C${f(cx - 94)} 300 ${f(cx - 40)} 286 ${f(cx + 10)} 288"/><path transform="rotate(${f(tilt)} ${f(cx)} 700)" d="M${f(cx - sw + 6)} 860C${f(cx - sw + 14)} 740 ${f(cx - sw * 0.55)} 664 ${f(cx - 20)} 654"/></g>`

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1080" preserveAspectRatio="xMidYMid slice">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient>` +
    `<radialGradient id="v" cx=".5" cy=".4" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>` +
    `<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16"/></filter>` +
    `<filter id="s" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter></defs>` +
    `<rect width="720" height="1080" fill="url(#g)"/>` +
    `<g filter="url(#b)" fill="${light}">${bokeh}</g>` +
    `<g filter="url(#s)">${motifLayer(motif, light, r)}</g>` +
    `<g filter="url(#s)" fill="${dark}" fill-opacity=".92">${figure}</g>` +
    `<g filter="url(#s)">${rim}</g>` +
    `<rect width="720" height="1080" fill="url(#v)"/></svg>`

  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  cache.set(key, uri)
  return uri
}

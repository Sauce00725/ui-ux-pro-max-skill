# Gym Buddy: Design System (Master)

Global source of truth for visual decisions. Page-specific overrides go in `pages/<page>.md`.
Tokens live in `src/styles/tokens.css`; component rules in `src/styles/components.css`.

## Direction: "Spatial Holo" (v2)

Content floats on lit glass over a slow aurora, and holographic foil marks the one thing
you're handling. It replaces v1's "Holographic HUD": the palette and the mono data voice
stay; corner brackets, scanlines and the scrolling grid are gone.

Built with the ui-ux-pro-max skill from these database matches:

| Layer | Source match | How it's applied |
| --- | --- | --- |
| Style | `--design-system` → Spatial UI (visionOS) | Depth: the top card tilts in 3D under your finger, with photo and info panel at different parallax depths |
| Material | style DB: Liquid Glass | Frosted, saturated glass with a gloss highlight and rim light (bright top edge, faint bottom) on panels, controls and the dock |
| Ambient | style DB: Aurora UI | One slow aurora behind every screen (36s, transform only) |
| Type motion | style DB: Kinetic Typography (high a11y risk) | Limited to two one-shot reveals: the landing headline and the match title |
| Palette | color DB: "Quantum Computing Interface" (kept from v1) | Cyan brand/like, violet secondary, magenta Super Like, on a near-void background |
| Display type | google-fonts DB: Anybody (wdth 50–150, wght 100–900) | Names, titles, stamps, wordmark. Always uppercase |
| Reading type | Inter | Body copy, bios, prompt answers, form labels |
| Data type | JetBrains Mono (kept) | `.hud-label` readouts, counters, clocks. **Never body copy** |

`--design-system` also proposed its own palette and Inter for everything; both were declined to
keep the brand, so it was not persisted. This file records what was actually used.

## Color tokens

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#03030a` | Void background (under the aurora) |
| `--color-surface` / `--color-card` | `#090a18` / `#0e1024` | Raised layers |
| `--color-fg` | `#f1f4ff` | Text (18.7:1 on bg) |
| `--color-muted-fg` | `#a0aacd` | Secondary text and readouts (8.9:1 on bg, 7.2:1 on muted) |
| `--color-primary` | `#22e6ff` | Brand, like, focus, active tab |
| `--color-on-primary` | `#001218` | Text on cyan and on the holo fill (≥5.8:1 everywhere on it) |
| `--color-secondary` | `#7b61ff` | Gradient partner |
| `--color-super` | `#ff3df2` | Super Like |
| `--color-pass` / `--color-pass-fg` | `#ff4d6d` / `#ff8fa3` | Pass glow / pass icon on glass |
| `--holo-spectrum` | cyan, violet, magenta, gold, mint | Foil: card rim, like halo, celebration edges. Never a text background |
| `--holo-fill` | cyan → `#5aa8ff` → `#8f7bff` | Text-safe holo: primary buttons, my chat bubbles, the Like button |

## Materials

- `glass` / `glass-strong`: frosted panes (22px / 40px blur, 180% saturate) with `--glass-gloss`
  and `--glass-sheen`. Add `glass-flat` for panes that sit in the page (list rows, tiles,
  settings sections): rim light, no drop shadow.
- `holo-rim`: static foil edge, only on surfaces that celebrate something (match dialog, the
  first landing pane). The top card has its own live rim (`.deck-rim`).
- `btn-holo`: the primary action of a view or form, so at most one per form. Header and
  utility actions use a `glass glass-flat` pill instead.
- Fallbacks: no `backdrop-filter` → opaque panels; `prefers-reduced-transparency` → solid
  `--color-surface`.

## Depth and light (the deck)

- The card moves in the plane (`.deck-card`); its face tilts in 3D (`.deck-face`, max
  `--tilt-max` 9deg, `--perspective` 1000px). Layers: photo (drifts against the tilt) → glare →
  info panel (drifts with it) → rim.
- **Tilt vs light:** pressing or dragging tilts the face and moves the light. A hovering mouse
  moves only the light (glare, foil, rim hue), because a 3D tilt softens text while reading.
- Everything is driven by CSS variables written by `useSwipeGesture` (no React re-render per frame).
- Short cards (under 460px, from a size container on the face) move the first prompt into the
  details, so the photo is never fully covered. The panel is never taller than the card; open
  details scroll inside it.

## Rules

- **Motion budget:** per view, one ambient loop (the aurora) plus one-shot reveals (the light
  sweep when a card arrives, the match moment, the landing headline). Input-driven light and
  tilt don't count: they only move while you do.
- **Springs:** `--ease-spring` / `--ease-spring-soft` are real spring curves (CSS `linear()`,
  zeta 0.62 / 0.7) with cubic-bezier fallbacks. Release, snap-back and the dock bead use them;
  presses use `--dur-press` with `--ease-soft`. Press scale settles at 0.95–0.97, never lower.
- **Reduced motion:** no aurora, no sweep, no tilt or card rotation (cards cross-fade); one-shot
  reveals jump to their end state.
- **Width, not truncation:** display text fits by condensing Anybody's width axis
  (`useFitStretch` measures; `fitStretch()` is the server-render guess). Titles that animate
  their width use fixed line breaks and container units (`cqi`) so they never re-wrap.
- **Display stretch:** `.font-display` defaults to 115%; wordmark and stamps 125%.
- **HUD voice** (`.hud-label`): mono, uppercase, 0.18em tracking, `//` prefix for section
  labels. Data only: counts, distances, clocks, status.
- **Radii:** card 28px, panel 20px (inner panels concentric: card radius minus inset), tiles
  12px; chips, buttons, controls and the dock are full pills.
- **Chrome:** the top bar fades out at its lower edge; the dock floats `--dock-gap` above the
  home indicator and content scrolls under it. `--dock-clearance` is the bottom inset for every
  scrolling screen, and `scroll-padding` keeps keyboard focus clear of both bars.
- **No invented metrics:** readouts show real data (distance, shared activities x/y, picks
  left, refill clock). No fake "compatibility %".

## Logo

`src/components/Logo.tsx` (`LogoMark`, `Logo`) and `src/app/icon.svg`.

- **Mark:** two figures (head + capsule body) linked by a bar: a dumbbell from a distance, two
  buddies holding on to each other up close. Cyan → violet gradient with a soft glow. With
  `linking`, the figures slide together and the bar locks in (the match moment).
- **Wordmark:** Anybody 900 at 125% width, uppercase. "GYM" in `--color-fg`, "BUDDY" in `--color-primary`.
- **Placement:** top app bar (every in-app screen), landing hero, auth screens, onboarding header,
  Settings footer, match dialog badge; favicon, Apple touch icon and PWA icons (`public/icons/`, incl. maskable).
- **Clear space:** at least the head diameter around the mark. Never recolor outside the palette.

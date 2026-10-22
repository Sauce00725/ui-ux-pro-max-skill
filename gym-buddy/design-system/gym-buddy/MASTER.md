# Gym Buddy: Design System (Master)

Global source of truth for visual decisions. Page-specific overrides go in `pages/<page>.md`.
Tokens live in `src/styles/tokens.css`; component rules in `src/styles/components.css`.

## Direction: "Holographic HUD"

Built with the ui-ux-pro-max skill from these verified database matches:

| Layer | Source match | How it's applied |
| --- | --- | --- |
| Style | `hud-sci-fi-fui` (HUD / Sci-Fi FUI) | 1px linework, glowing corner brackets, mono readouts, one-shot scan sweep, layered on the existing glass surfaces |
| Palette | "Quantum Computing Interface" | Cyan brand/like, violet secondary, magenta accent, on a near-void background |
| Display type | "Crypto/Web3" pairing (Orbitron) | Headings, names, stamps. Always uppercase |
| Reading type | "Crypto/Web3" pairing (Exo 2) | Body copy, bios, form labels |
| Data type | "Cyberpunk Mobile" pairing (JetBrains Mono) | HUD labels, chips, counters, clocks. **Never body copy** |

`--design-system` with `--variance 8` resolved to Brutalism, which contradicts "futuristic",
so it was not persisted; the table above records the style/color/type matches actually used.

## Color tokens

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#050510` | Void background |
| `--color-surface` / `--color-card` | `#0a0b1c` / `#10122a` | Raised layers |
| `--color-fg` | `#eef3ff` | Text |
| `--color-muted-fg` | `#9ba6c9` | Secondary text and HUD labels (~8:1 on bg) |
| `--color-primary` | `#22e6ff` | Brand, like, focus, active nav (softened from `#00FFFF`) |
| `--color-on-primary` | `#001218` | Text on cyan |
| `--color-secondary` | `#7b61ff` | Gradient partner, grid verticals |
| `--color-accent` | `#ff3df2` | Pass-side glow |
| `--color-pass` / `--color-danger` | `#ff4d6d` | Pass, errors |

## Rules

- **Motion budget:** at most two moving elements per view (UX DB, "Excessive Motion"): the grid
  floor loop and the per-card scan sweep. Ambient glows react to input but don't loop.
  Both stop under `prefers-reduced-motion`.
- **HUD voice** (`.hud-label`): mono, uppercase, 0.18em tracking, `//` prefix for section
  labels. Data only: counts, distances, clocks, status.
- **Brackets** (`.hud-frame`): one per surface that has focus or importance (top card, empty
  state, match dialog, landing feature tiles). Tint with `--hud-color`.
- **Radii:** card 16px, panel 12px, chip 4px. Machined, not soft.
- **No invented metrics:** HUD readouts show real data (distance, shared activities x/y,
  quota, refill clock). No fake "compatibility %".
- **Orbitron runs wide:** keep display sizes at or below `--text-display`, and truncate single-line names.

## Logo

`src/components/Logo.tsx` (`LogoMark`, `Logo`) and `src/app/icon.svg`.

- **Mark:** two figures (head + capsule body) linked by a bar: a dumbbell from a distance, two
  buddies holding on to each other up close. Cyan → violet gradient with a soft glow.
- **Wordmark:** Orbitron 900, uppercase. "GYM" in `--color-fg`, "BUDDY" in `--color-primary`.
- **Placement:** top app bar (every in-app screen), landing hero, auth screens, onboarding header,
  Settings footer; favicon, Apple touch icon and PWA icons (`public/icons/`, incl. maskable).
- **Clear space:** at least the head diameter around the mark. Never recolor outside the palette.

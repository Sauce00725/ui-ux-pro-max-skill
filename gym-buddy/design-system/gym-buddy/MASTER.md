# Gym Buddy: Design System (Master)

Global source of truth for visual decisions. Page-specific overrides go in `pages/<page>.md`.
Tokens live in `src/styles/tokens.css`; component rules in `src/styles/components.css`.

## Direction: "Volt" (v3)

Built like race telemetry, at every pace: graphite, an electric volt brand color, and type
that leans forward. Numbers read like a scoreboard; feedback arrives as speed lines and
slammed-on tags. Chosen over two alternatives compared side by side on the same screens:
"Spatial Holo" (v2: liquid glass, 3D-tilting holographic cards) and "Signal" (dot-matrix
monochrome with LED light rails).

Built with the ui-styling skill (scoped CSS-variable tokens, a short design philosophy, a 2–5
color palette) and these ui-ux-pro-max database matches:

| Layer | Source match | How it's applied |
| --- | --- | --- |
| Style | style DB: Kinetic Typography (high a11y risk) | Leaning, condensed display type; one-shot reveals only (landing headline, match title) |
| Style | style DB: Vibrant & Block-based | Solid volt blocks: the Like disc, primary buttons, the active-tab block, shared-activity chips, LIKE/PASS/SUPER tags |
| Palette | color DB: "Fitness/Gym App" (energy colors on dark) | Pushed to volt (brand, like), heat (pass) and ultraviolet (Super Like) on graphite |
| Type | typography DB: "Sports/Fitness" pairing (Barlow Condensed + Barlow) | Informed the condensed athletic voice; Saira used instead for its width axis (names condense to fit) and italics |
| Data type | JetBrains Mono (kept) | `.hud-label` readouts, counters, clocks. **Never body copy** |

## Voice

- **Slogan:** "Spot the one." Dates, a spotter, a running partner, an event: the one is whatever
  you came for. Eyebrow on the landing page: "Every body welcome".
- **Write for every body and every level.** Never assume someone is already fit, able-bodied,
  a certain size, age or gender. Movement words are fine for actions ("train", "run"), never as a
  condition for belonging; "Meet people who move" was retired for that reason.
- **Beginners are first-class:** "Brand new or years in, you belong here."
- **Dating copy is gender-neutral:** dates, matches, partners.

## Color tokens

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#0a0a0b` | Graphite background |
| `--color-surface` / `--color-card` | `#111113` / `#151518` | Raised layers |
| `--color-fg` | `#f6f6ef` | Text (18.2:1 on bg) |
| `--color-muted-fg` | `#a6a6ad` | Secondary text and readouts (8.2:1 on bg, 6.8:1 on muted) |
| `--color-primary` | `#d4ff3a` | Volt: brand, like, focus, active tab (17:1 on bg) |
| `--color-on-primary` | `#0a0a0b` | Text and icons on volt (17:1) |
| `--color-super` / `--color-secondary` | `#9b8cff` | Ultraviolet: Super Like (7.2:1 on bg) |
| `--color-pass` / `--color-accent` | `#ff5b3a` | Heat: pass, errors, beginner-friendly (6.4:1 on bg) |
| `--rim-stops` | volt, white, volt, graphite | Lit edges: the top card, the match dialog, the first landing pane |

## Type

- **Display** (`.font-display`): Saira, italic, 70% width by default, uppercase. Names, titles,
  tags, the quota number. The wordmark runs wide (125%) for a racing feel.
- **Reading:** Saira at normal width for body copy, bios and prompt answers.
- **Width, not truncation:** names and the deck title start at 75% and condense to fit (`useFitStretch`
  measures; `fitStretch()` is the server-render guess). Titles that animate their width use fixed
  line breaks and container units (`cqi`) so they never re-wrap.

## Rules

- **Motion:** see "Motion" below. In short: one choreography file, one hero motion at a time,
  transform and opacity only, and reduced motion lands on the finished design.
- **Springs:** `--ease-spring` is a real spring curve (CSS `linear()`, zeta 0.62) with a
  cubic-bezier fallback. Release, snap-back, the dock block and chat bubbles use it; presses use
  `--dur-press` with `--ease-soft`. Press scale settles at 0.95–0.97, never lower.
- **Slant:** chips, tags, the active-tab block and landing panes lean (skew −8° to −10°) with the
  italics. Body copy and inputs never lean.
- **Volt is for action:** solid volt marks what you can do or what you share (Like, primary
  button, active tab, shared activities). One primary button per form; header and utility actions
  use a `glass glass-flat` pill.
- **Radii:** card 16px, panel 12px (inner panels concentric: card radius minus inset), tags 6px;
  buttons and controls stay pills.
- **Chrome:** the top bar fades out at its lower edge; the dock floats `--dock-gap` above the
  home indicator and content scrolls under it. `--dock-clearance` is the bottom inset for every
  scrolling screen, and `scroll-padding` keeps keyboard focus clear of both bars.
- **Fallbacks:** no `backdrop-filter` → opaque panels; `prefers-reduced-transparency` → solid
  `--color-surface`.
- **No invented metrics:** readouts show real data (distance, shared activities x/y, picks left,
  refill clock). No fake "compatibility %".

## Motion: "Spot → Lock → Launch"

All choreography lives in **`src/styles/motion.css`**. `tokens.css` and `components.css` describe
the finished, static design; delete that one import and the app is still whole. Built with the
ui-ux-pro-max animation rules (motion conveys meaning, exits faster than entrances, stagger
30–50ms, one or two key elements per view, spring physics, interruptible, never block input).

### Rules
- **Anticipate, strike, settle.** Something spots a target, locks, then launches. One hero motion
  at a time; everything else waits its turn on a stagger (letters 34ms apart, list items 45ms
  apart, capped at the eighth so a long list never makes you wait).
- **Entrances decelerate** (`--ease-out-expo`, or the `--ease-spring` spring). **Exits
  accelerate** (`--ease-leave`) and run about a third as long (`--dur-exit`, 220ms).
- **transform and opacity only**, written as the individual `translate`, `scale` and `rotate`
  properties, so they stack on the transforms components already set (skew, drag) instead of
  fighting them.
- **Base style = final state.** Animations use `fill-mode: backwards`: during a delay the element
  waits in its first keyframe, afterwards it returns to its base style. Nothing lingers: no
  stuck transform, no stray containing block for fixed children.
- **Reduced motion:** everything that plays sits inside `prefers-reduced-motion: no-preference`;
  `--lean-deg`, `--parallax` and `--rise` also drop to zero. Nothing runs, and every screen
  renders its end state (checked: no running animations on the landing, deck or match scene).
- **Nothing waits on `animationend`.** Sequencing is delays; the only JS timers are the card
  exit and the match dialog's close.
- **Slam text** (`<Slam>`): the real words stay in the DOM for screen readers; the split
  letters are `aria-hidden`.

### Sequences
| Moment | What plays | Timing |
| --- | --- | --- |
| Landing | Logo and eyebrow rise; "SPOT" then "THE ONE." land letter by letter (stretched on the way down, squashed on impact); viewfinder brackets lock on "the one."; one band of light crosses the headline; panes slide in along their lanes; the buttons rise and "Create account" gets one shine | ~2.3s |
| New top card | Corner brackets close on it (`lock`), then one scan flash crosses | 520ms + 380ms offset |
| Dragging | Card leans into the throw (shear about its centre), the photo drifts against the drag (clamped, so no edge shows), stamps and speed lines read the live swipe signals | live |
| Throw | By hand 380ms (it has your momentum); by button or key 560ms on a gentler curve. Aftermath via `data-fire` on the stage: the tag stomps in, the control you used answers (Like pumps, Super spins its star, Pass shakes), a ring leaves the deck in the action's colour | ~0.6s |
| Quota | The count rolls like an odometer; the pick you just spent burns out hot | 300ms |
| Match | Veil fades in; your photo and theirs fly in from either side on a spring and collide; flash, 14 light shards and a shake; the logo's figures slide together and the bar locks; the headline lands letter by letter; the rest rises. Closes on a 220ms exit (Esc and "Keep looking") | ~1.6s |
| Screens | Each screen slides in from the way you travelled along the dock (forward from the right, back from the left, up on first load): `(app)/template.tsx` | 480ms |
| Dock | The volt block springs to the tab and stretches while it travels (longer trips stretch more); the icon you land on pops; items scale on press | 520ms |
| Lists | Chats, Likes, Events, Settings and the auth screens reveal item by item (`.cascade`) | 45ms steps |
| Chat | New bubbles spring in from their tail (only messages newer than what was on screen when the chat opened, so history and "Load earlier" never animate); the send icon launches and returns | 380ms |

### Tokens (in `tokens.css`)
`--ease-leave`, `--dur-lock` (520ms), `--dur-slam` (560ms), `--dur-rise` (480ms), `--dur-exit`
(220ms), `--step-letter` (34ms), `--step-item` (45ms), `--rise` (14px), `--lean-deg` (3deg),
`--parallax` (-0.05), `--t-impact` (340ms, the match scene's collision).

### Verifying motion
Animations are checked frame by frame rather than by eye: restart the subtree, freeze the
document timeline (CDP `Animation.setPlaybackRate(0)`), seek every animation to a time and
screenshot. Freeze JS timers too (stretch `setTimeout`) when the sequence involves a swipe.

## Logo

`src/components/Logo.tsx` (`LogoMark`, `Logo`), `src/app/icon.svg`, `src/app/apple-icon.png`
and `public/icons/`.

- **Mark:** two figures (head + capsule body) linked by a bar: a dumbbell from a distance, two
  buddies holding on to each other up close. Volt gradient (`--logo-1/2/3`). With `linking`, the
  figures slide together and the bar locks in (the match moment).
- **Wordmark:** Saira 900 italic at 125% width, uppercase. "GYM" in `--color-fg`, "BUDDY" in `--color-primary`.
- **Placement:** top app bar (every in-app screen), landing hero, auth screens, onboarding header,
  Settings footer, match dialog badge; favicon, Apple touch icon and PWA icons (incl. maskable).
- **Clear space:** at least the head diameter around the mark. Never recolor outside the palette.

# Clickable prototype

The real Gym Buddy screens, styles and motion running against an in-memory demo backend, in one
HTML file. No Supabase, no accounts, no server: open it and swipe, match, chat, RSVP.

```bash
npm run prototype              # → prototype/dist/index.html (open it in a browser)
npm run prototype -- --fonts   # same, with Saira and JetBrains Mono embedded (run `next build` first)
npm run typecheck:prototype
```

Without `--fonts` the page loads the two typefaces from Google Fonts, so it needs a connection.

## How the real code runs without its backend

Nothing in `src/` is copied or forked. `build.mjs` bundles the same components, and esbuild swaps
the handful of modules that talk to Next or Supabase for stand-ins:

| Real module | Prototype stand-in (`src/stubs/`) |
| --- | --- |
| `next/link`, `next/navigation` | `link.tsx`, `navigation.tsx` on a tiny router (`src/router.tsx`) |
| `app/(app)/discover/actions` (swipe, refresh) | `discover-actions.ts` |
| `app/(app)/matches/actions`, `events/actions`, `settings/actions`, `(auth)/actions` | matching `*-actions.ts` |
| `app/actions/translate` | `translate-action.ts` (a phrasebook, not a model) |
| `lib/supabase/client` (chat realtime, uploads) | `supabase-client.ts` |

All of them read and write `src/demo/world.ts`: quotas (10 picks per 6 hours, one Super Like a
day), swipes, matches, messages, RSVPs. The cast is in `src/demo/people.ts`; photos are drawn as SVG
(`src/demo/art.ts`), so there are no image files.

Each Next page is "fetch data, hand it to a view". The views (`components/*/…View.tsx`,
`components/landing/Landing.tsx`) are shared: the pages feed them Supabase data, and
`src/screens.tsx` feeds them demo data. Change a view and both change together.

## What's in it

Landing intro, sign-up, Match and Partners decks (drag, tap, or ← ↑ →), the match scene, Likes (and
liking back), Chats with typing, replies, read receipts and Translate, Events (filters, RSVP,
posting), Settings, and the page, dock and list motion between them. A "Prototype" pill by the
profile button opens a guide plus shortcuts to states that would take hours (the 6-hour refill) or
luck (a match).

Not in it: onboarding, and anything that needs a real account or server (email confirmation,
moderation, notifications).

## Keeping it honest

The prototype is a view of the app's UI, not its logic. Matching, quotas and moderation live in
SQL (`supabase/migrations/`), and `world.ts` only imitates them. When a screen's data shape
changes, the type checker (`npm run typecheck:prototype`) points at the stub that needs to follow.

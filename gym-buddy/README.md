# Gym Buddy

Spot the one. Dating, Training Partners and local fitness events for every body and every level.
Next.js 15 (App Router) + Supabase (Postgres/PostGIS, Auth, Storage, Realtime) + Tailwind v4.
Visual direction: "Volt": graphite and electric lime, condensed italic type, speed lines (see `design-system/gym-buddy/MASTER.md`).

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Apply the schema.** Either paste the files in `supabase/migrations/` into the SQL editor
   in order (`0001_init.sql` → `0007_translation_quota.sql`), or with the Supabase CLI:
   `supabase link --project-ref <ref> && supabase db push`.
3. **Auth settings** (Authentication → URL Configuration): set Site URL to `http://localhost:3000`
   and add `http://localhost:3000/auth/callback` to Redirect URLs.
4. **Env vars:** `cp .env.example .env.local` and fill in the Supabase URL and anon/publishable key, plus
   `ANTHROPIC_API_KEY` for translation (server-side only).
5. `npm install && npm run dev` and open http://localhost:3000.

**Sample events:** `supabase/seed.sql` adds fictional upcoming events in 8 US metros (Austin, NYC, LA,
Chicago, Denver, Miami, Seattle, Atlanta). `supabase db reset` runs it; or paste it into the SQL editor.
Member-posted events start `pending`: approve with `update events set moderation = 'approved' where id = '…';`

**Dev tip:** photos start as `pending` and only `approved` photos appear in feeds. Until the
moderation pipeline exists, approve them manually in the SQL editor:

```sql
update photos set moderation = 'approved' where moderation = 'pending';
```

To test matching, sign up two accounts (two browsers, or one in a private window) near each
other, turn on the same mode, and like each other.

## Where things live

| Feature | Files |
| --- | --- |
| Schema, RLS, match trigger, discovery feed | `supabase/migrations/0001_init.sql` |
| Sign-up / login | `src/app/(auth)/`, `src/app/auth/callback/route.ts` |
| Onboarding (4 steps + photo upload) | `src/app/onboarding/`, `src/components/PhotoUploader.tsx` |
| Validation (shared client + server) | `src/lib/validation.ts` |
| Discovery feed + swipe | `src/lib/discovery.ts`, `src/app/(app)/discover/` |
| Slow-dating quota (10 swipes / 6 h per mode) | `supabase/migrations/0002_swipe_quota.sql` |
| Goals, beginner ↔ helper matching, starter activities | `supabase/migrations/0003_goals_beginners.sql` |
| Spanish ↔ English translation (messages, like comments, profiles) | `src/lib/translate.ts`, `src/app/actions/translate.ts`, `src/components/translate/`, `supabase/migrations/0007_translation_quota.sql` |
| Prompt catalog (40 prompts: get to know me, gym life, training) | `src/lib/validation.ts` (`PROMPT_GROUPS`), `supabase/migrations/0006_more_prompts.sql` |
| Super Likes (1/day), prompts, like-a-photo/prompt with a comment | `supabase/migrations/0004_superlikes_prompts_comments.sql` |
| Events (list + filters, detail, RSVP, post) | `supabase/migrations/0005_events.sql`, `src/app/(app)/events/`, `src/components/events/` |
| Profile settings (edit everything after onboarding) | `src/app/(app)/settings/`, `src/components/settings/`, `src/components/profile/ProfileFields.tsx` |
| Logo + app icons | `src/components/Logo.tsx`, `src/app/icon.svg`, `src/app/apple-icon.png`, `public/icons/` |
| Likes inbox (who liked you, before matching) | `src/app/(app)/likes/`, `src/components/likes/LikesInbox.tsx` |
| Like composer (comment on a photo/prompt) | `src/components/deck/LikeComposer.tsx` |
| Daily Selection deck | `src/components/deck/` (see below) |
| Design tokens + component styles | `src/styles/tokens.css`, `src/styles/components.css` |
| Motion (all choreography, reduced-motion safe) | `src/styles/motion.css`, `src/components/Slam.tsx`, `src/app/(app)/template.tsx` |
| Design system rationale | `design-system/gym-buddy/MASTER.md` |
| Chat (real-time) | `src/components/chat/useChat.ts`, `src/components/chat/ChatWindow.tsx` |
| Block / report / unmatch | `src/app/(app)/matches/actions.ts` |
| Session refresh + route protection | `src/middleware.ts`, `src/lib/supabase/` |

## Daily Selection deck

Two state layers that never mix:

- **Domain** (`deckState.ts`, `useDailyDeck.ts`): cards, quota, match. A pure reducer;
  `selectDeckView()` is the only place that decides *deck / loading / quota-exhausted /
  pool-exhausted*.
- **Visual** (`useSwipeGesture.ts`): pointer physics written straight to CSS variables
  (`--drag-x/y/rot` on the card; `--swipe-amount`, `--like-strength`, `--pass-strength` on the
  stage). No React re-render during a drag. Stamps, stacked cards, glows and buttons all read
  the same inherited variables.

They meet at two callbacks: `onCommit` (released, start the server call) and `onExited`
(card has left the screen). `DailyDeck.tsx` wires them; every other file is presentational.
`useDailyDeck` takes an optional `api` prop, so the deck runs against mocks in tests or a
Storybook.

## Translation

Incoming messages, like comments and profiles written in the other language get a one-tap
**Translate** control (Settings → Translation picks English or Español; stored per device).

- **Model:** Claude Opus 5.5 at low effort, with a strict JSON output schema, re-validated with Zod,
  and server-side refusal fallbacks (`fallbacks: "default"`). Change `TRANSLATE_MODEL` in
  `src/lib/translate.ts` to trade quality for cost (for example `claude-haiku-5-5`).
- **Limits:** signed-in members only; ≤ 8 texts / 6,000 characters per request; 120 uncached
  requests per member per hour (enforced in the database). Repeat translations come from an
  in-memory cache (per server instance) and the browser session.
- **Privacy:** text is sent to Anthropic only when a member taps Translate. Mention this in your
  privacy policy.

## Not built yet

- Events: map view, venue geocoding, automated imports (RunSignUp etc.), admin approval UI.
- ZIP-code location fallback.
- Automated photo/text moderation, admin review queue, selfie verification.
- `/terms`, `/privacy`, `/guidelines` pages (linked from sign-up).
- Push/email notifications for new matches and messages.
- A Spanish version of the app's own interface (translation covers member-written text only).

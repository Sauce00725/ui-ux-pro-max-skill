# Gym Buddy

Dating, Gym Buddies and local fitness events for active people.
Next.js 15 (App Router) + Supabase (Postgres/PostGIS, Auth, Storage, Realtime) + Tailwind v4.
Visual direction: holographic HUD (see `design-system/gym-buddy/MASTER.md`).

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Apply the schema.** Either paste the files in `supabase/migrations/` into the SQL editor
   in order (`0001_init.sql` → `0005_events.sql`), or with the Supabase CLI:
   `supabase link --project-ref <ref> && supabase db push`.
3. **Auth settings** (Authentication → URL Configuration): set Site URL to `http://localhost:3000`
   and add `http://localhost:3000/auth/callback` to Redirect URLs.
4. **Env vars:** `cp .env.example .env.local` and fill in the URL and anon/publishable key.
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
| Super Likes (1/day), prompts, like-a-photo/prompt with a comment | `supabase/migrations/0004_superlikes_prompts_comments.sql` |
| Events (list + filters, detail, RSVP, post) | `supabase/migrations/0005_events.sql`, `src/app/(app)/events/`, `src/components/events/` |
| Profile settings (edit everything after onboarding) | `src/app/(app)/settings/`, `src/components/settings/`, `src/components/profile/ProfileFields.tsx` |
| Logo + app icons | `src/components/Logo.tsx`, `src/app/icon.svg`, `src/app/apple-icon.png`, `public/icons/` |
| Likes inbox (who liked you, before matching) | `src/app/(app)/likes/`, `src/components/likes/LikesInbox.tsx` |
| Like composer (comment on a photo/prompt) | `src/components/deck/LikeComposer.tsx` |
| Daily Selection deck | `src/components/deck/` (see below) |
| Design tokens + component styles | `src/styles/tokens.css`, `src/styles/components.css` |
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

## Not built yet

- Events: map view, venue geocoding, automated imports (RunSignUp etc.), admin approval UI.
- ZIP-code location fallback.
- Automated photo/text moderation, admin review queue, selfie verification.
- `/terms`, `/privacy`, `/guidelines` pages (linked from sign-up).
- Push/email notifications for new matches and messages.

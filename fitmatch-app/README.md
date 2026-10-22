# FitMatch

Dating, Gym Buddies and local fitness events for active people.
Next.js 15 (App Router) + Supabase (Postgres/PostGIS, Auth, Storage, Realtime) + Tailwind v4.

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Apply the schema.** Either paste `supabase/migrations/0001_init.sql` into the SQL editor,
   or with the Supabase CLI: `supabase link --project-ref <ref> && supabase db push`.
3. **Auth settings** (Authentication → URL Configuration): set Site URL to `http://localhost:3000`
   and add `http://localhost:3000/auth/callback` to Redirect URLs.
4. **Env vars:** `cp .env.example .env.local` and fill in the URL and anon/publishable key.
5. `npm install && npm run dev` and open http://localhost:3000.

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
| Chat (real-time) | `src/components/chat/useChat.ts`, `src/components/chat/ChatWindow.tsx` |
| Block / report / unmatch | `src/app/(app)/matches/actions.ts` |
| Session refresh + route protection | `src/middleware.ts`, `src/lib/supabase/` |

## Not built yet

- Events tab (stub). Next phase: `events` + `event_rsvps` tables, map/list, organizer submissions.
- Profile editing/settings page, ZIP-code location fallback.
- Automated photo/text moderation, admin review queue, selfie verification.
- `/terms`, `/privacy`, `/guidelines` pages (linked from sign-up).
- Push/email notifications for new matches and messages.

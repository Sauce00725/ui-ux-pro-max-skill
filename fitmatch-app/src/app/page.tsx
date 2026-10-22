import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, Dumbbell, Heart, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const FEATURES = [
  { icon: Heart, title: 'Dating', body: 'Match with people who share your training, schedule and goals.' },
  { icon: Users, title: 'Gym Buddies', body: 'Find a spotter, a running partner or a pickleball fourth. Friends only.' },
  { icon: CalendarDays, title: 'Events', body: 'Run clubs, CrossFit, open play: what’s happening near you.' },
]

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/discover')

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-10">
      <div className="inline-flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wide">
        <span className="grid size-10 place-items-center rounded-chip bg-primary text-on-primary shadow-[0_0_20px_rgb(34_230_255/0.5)]">
          <Dumbbell className="size-5" aria-hidden />
        </span>
        FitMatch
      </div>

      <p className="hud-label mt-16 text-primary">// v2.0 · active-lifestyle network</p>
      <h1 className="mt-3 font-display text-5xl font-black uppercase leading-[0.95] [text-shadow:0_0_30px_rgb(34_230_255/0.35)]">
        Meet people <span className="text-primary">who move.</span>
      </h1>
      <p className="mt-4 text-lg text-muted-fg">Dates, training partners and local events, for active people.</p>

      <ul className="mt-10 space-y-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="glass hud-frame relative flex gap-4 rounded-panel p-4 shadow-none [--hud-bracket:10px]">
            <span className="grid size-11 shrink-0 place-items-center rounded-chip border border-primary/40 bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-base font-bold uppercase tracking-wider">{title}</h2>
              <p className="text-sm text-muted-fg">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-3 pt-10">
        <Link href="/signup" className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-on-primary hover:bg-primary-hover">
          Create account
        </Link>
        <Link href="/login" className="flex h-12 items-center justify-center rounded-xl border font-semibold hover:bg-surface">
          Log in
        </Link>
      </div>
    </main>
  )
}

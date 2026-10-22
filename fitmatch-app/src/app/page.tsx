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
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-on-primary">
          <Dumbbell className="size-5" aria-hidden />
        </span>
        FitMatch
      </div>

      <h1 className="mt-16 font-display text-6xl font-bold uppercase leading-[0.9]">
        Meet people <span className="text-primary">who move.</span>
      </h1>
      <p className="mt-4 text-lg text-muted-fg">Dates, training partners and local events, for active people.</p>

      <ul className="mt-10 space-y-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4 rounded-2xl bg-surface p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold uppercase">{title}</h2>
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

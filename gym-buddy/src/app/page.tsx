import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, Heart, Users } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

// Each pane is a real part of the product, nothing made up.
const FEATURES = [
  { icon: Heart, title: 'Dating', body: '10 picks every 6 hours. Slow, on purpose.' },
  { icon: Users, title: 'Training Partners', body: 'A spotter, a running partner, or someone patient to start with.' },
  { icon: CalendarDays, title: 'Events', body: 'Run clubs, CrossFit and open play near you.' },
]

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/discover')

  return (
    <main className="@container mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-(--space-gutter) pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Logo size="md" />

      <p className="hud-label mt-14 text-primary">// Every body welcome</p>
      <h1 className="hero-title mt-3 font-display text-hero font-black uppercase">
        <span className="block whitespace-nowrap">Your pace.</span>
        <span className="block whitespace-nowrap text-primary">Your people.</span>
      </h1>
      <p className="mt-5 text-lg text-muted-fg">
        Dates, training partners and local events for every level. Brand new or years in, you belong here.
      </p>

      {/* What's inside, as slanted panes, each a lane further over */}
      <ul className="hero-stage mt-10">
        {FEATURES.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className={cn('hero-pane flex items-center gap-4 rounded-panel border border-[color:var(--glass-stroke-strong)] px-4 py-3', i === 0 && 'rim-light')}>
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-[0_0_18px_-6px_var(--color-primary)]">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-extrabold uppercase">{title}</h2>
              <p className="text-sm text-muted-fg">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-3 pt-10">
        <Link href="/signup" className="btn-primary flex h-12 items-center justify-center rounded-full font-semibold">
          Create account
        </Link>
        <Link
          href="/login"
          className="glass glass-flat flex h-12 items-center justify-center rounded-full font-semibold transition-colors duration-200 hover:bg-(--glass-fill-hover)"
        >
          Log in
        </Link>
      </div>
    </main>
  )
}

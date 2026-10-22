import Link from 'next/link'
import { CalendarPlus, Sprout } from 'lucide-react'
import { EventList } from '@/components/events/EventList'
import { getEvents } from '@/lib/events'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { EVENT_RADII, EVENT_WHEN, type EventWhen } from '@/lib/validation'

export const metadata = { title: 'Events' }

type Params = { when?: string; radius?: string; activity?: string; beginner?: string }

function parse(p: Params) {
  const when: EventWhen = p.when && p.when in EVENT_WHEN ? (p.when as EventWhen) : 'week'
  const radius = EVENT_RADII.find((r) => String(r) === p.radius) ?? 25
  return { when, radius, activity: p.activity || null, beginner: p.beginner === '1' }
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const filters = parse(await searchParams)
  const supabase = await createClient()

  const [events, { data: activities }] = await Promise.all([
    getEvents(supabase, { radiusMi: filters.radius, activity: filters.activity, when: filters.when, beginner: filters.beginner }),
    supabase.from('activities').select('slug, name').order('name'),
  ])

  /** Link to the same page with one filter changed (filters are deep-linkable). */
  const href = (patch: Partial<{ when: string; radius: number; activity: string | null; beginner: boolean }>) => {
    const next = { ...filters, ...patch }
    const q = new URLSearchParams()
    if (next.when !== 'week') q.set('when', next.when)
    if (next.radius !== 25) q.set('radius', String(next.radius))
    if (next.activity) q.set('activity', next.activity)
    if (next.beginner) q.set('beginner', '1')
    const s = q.toString()
    return s ? `/events?${s}` : '/events'
  }

  const chip = (active: boolean) =>
    cn(
      'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-chip border px-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em] transition-colors',
      active
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-[color:var(--glass-stroke)] text-muted-fg hover:border-[color:var(--glass-stroke-strong)] hover:text-fg',
    )

  return (
    <main className="mx-auto max-w-md px-(--space-gutter) pt-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="hud-label text-primary">// Local events</p>
          <h1 className="font-display text-title font-bold uppercase [text-shadow:0_0_16px_rgb(34_230_255/0.4)]">Events</h1>
          <p className="mt-1 text-sm text-muted-fg">Run clubs, CrossFit, pickleball, open gyms and more near you.</p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-panel bg-primary px-3 text-sm font-semibold text-on-primary transition-shadow hover:shadow-[0_0_24px_rgb(34_230_255/0.45)]"
        >
          <CalendarPlus className="size-4" aria-hidden /> Post
        </Link>
      </div>

      {/* Filters */}
      <nav aria-label="Event filters" className="mt-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EVENT_WHEN) as EventWhen[]).map((w) => (
            <Link key={w} href={href({ when: w })} className={chip(filters.when === w)} aria-current={filters.when === w ? 'true' : undefined}>
              {EVENT_WHEN[w]}
            </Link>
          ))}
          <Link href={href({ beginner: !filters.beginner })} className={chip(filters.beginner)} aria-pressed={filters.beginner}>
            <Sprout className="size-3.5" aria-hidden /> Beginner-friendly
          </Link>
        </div>
        <div className="flex gap-2">
          {EVENT_RADII.map((r) => (
            <Link key={r} href={href({ radius: r })} className={chip(filters.radius === r)} aria-current={filters.radius === r ? 'true' : undefined}>
              {r} mi
            </Link>
          ))}
        </div>
        <div className="-mx-(--space-gutter) flex gap-2 overflow-x-auto px-(--space-gutter) pb-1">
          <Link href={href({ activity: null })} className={chip(!filters.activity)}>All</Link>
          {(activities ?? []).map((a) => (
            <Link key={a.slug} href={href({ activity: a.slug })} className={chip(filters.activity === a.slug)}
              aria-current={filters.activity === a.slug ? 'true' : undefined}>
              {a.name}
            </Link>
          ))}
        </div>
      </nav>

      {events.length ? (
        <EventList events={events} />
      ) : (
        <section className="glass hud-frame relative mt-6 rounded-card p-(--space-card) text-center">
          <h2 className="font-display text-lg font-bold uppercase">Nothing scheduled yet</h2>
          <p className="mt-1 text-sm text-muted-fg">
            No events match these filters within {filters.radius} miles. Try a wider radius, or start one: a weekly run,
            an open gym, a pickleball meetup.
          </p>
          <Link href="/events/new" className="mt-4 inline-flex h-11 items-center gap-2 rounded-panel bg-primary px-4 font-semibold text-on-primary">
            <CalendarPlus className="size-4" aria-hidden /> Post an event
          </Link>
        </section>
      )}
    </main>
  )
}

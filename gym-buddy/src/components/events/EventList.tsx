'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Clock, MapPin, Sprout, Users } from 'lucide-react'
import type { EventItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { dateBlock, dayKey, dayLabel, formatCost, timeRange } from './format'
import { RsvpButton } from './RsvpButton'

/**
 * Events grouped by local day. Rendered after mount so dates and times use
 * the viewer's timezone without a server/client mismatch.
 */
export function EventList({ events }: { events: EventItem[] }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="mt-4 space-y-3" aria-busy>
        {[0, 1, 2].map((i) => <div key={i} className="glass glass-flat h-28 animate-pulse rounded-panel" />)}
      </div>
    )
  }

  const groups: { key: string; label: string; items: EventItem[] }[] = []
  for (const e of events) {
    const key = dayKey(e.startsAt)
    const g = groups.at(-1)
    if (g?.key === key) g.items.push(e)
    else groups.push({ key, label: dayLabel(e.startsAt), items: [e] })
  }

  return (
    <div className="mt-4 space-y-6 pb-6">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`day-${g.key}`}>
          <h2 id={`day-${g.key}`} className="hud-label mb-2 text-primary">// {g.label}</h2>
          <ul className="space-y-3">
            {g.items.map((e) => <EventCard key={e.id} event={e} />)}
          </ul>
        </section>
      ))}
    </div>
  )
}

function EventCard({ event: e }: { event: EventItem }) {
  const d = dateBlock(e.startsAt)
  const full = e.capacity !== null && e.goingCount >= e.capacity
  return (
    <li className="glass glass-flat relative flex gap-3 rounded-panel p-3 transition-colors duration-200 hover:bg-(--glass-fill-hover)">
      {/* date block */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-chip border border-[color:var(--glass-stroke)] bg-[color:var(--glass-fill)] py-2">
        <span className="hud-label text-primary">{d.weekday}</span>
        <span className="font-display text-2xl font-bold leading-none">{d.day}</span>
        <span className="hud-label">{d.month}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {e.activityName && <span className="hud-label">{e.activityName}</span>}
          {e.beginnerFriendly && (
            <span className="flex items-center gap-1 font-mono text-[0.6875rem] uppercase tracking-wider text-secondary-fg">
              <Sprout className="size-3" aria-hidden /> Beginner-friendly
            </span>
          )}
          {e.moderation === 'pending' && (
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-super)]">Pending review</span>
          )}
        </p>
        {/* Stretched link: the whole card opens the event, the RSVP button sits above it. */}
        <Link href={`/events/${e.id}`} className="mt-0.5 block font-semibold leading-snug after:absolute after:inset-0 after:content-['']">
          {e.title}
        </Link>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-fg">
          <Clock className="size-3.5 shrink-0" aria-hidden /> {timeRange(e.startsAt, e.endsAt)}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-fg">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{e.venueName}</span>
          {e.distanceMi !== null && <span className="shrink-0 font-mono text-xs">· {e.distanceMi} mi</span>}
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs uppercase tracking-wider">
            <span className={cn(e.costCents === 0 ? 'text-primary' : 'text-fg')}>{formatCost(e.costCents)}</span>
            <span className="flex items-center gap-1 text-muted-fg">
              <Users className="size-3.5" aria-hidden /> {e.goingCount}{e.capacity ? `/${e.capacity}` : ''} going
            </span>
            {e.buddiesGoing > 0 && <span className="text-primary">{e.buddiesGoing} matches</span>}
          </p>
          <RsvpButton eventId={e.id} title={e.title} initialGoing={e.iAmGoing} showMe={e.myShowMe} full={full} />
        </div>
      </div>
    </li>
  )
}

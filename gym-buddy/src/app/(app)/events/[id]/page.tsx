import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, MapPin, Sprout, Ticket, Users } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { EventWhenLine } from '@/components/events/EventWhenLine'
import { RsvpPanel } from '@/components/events/RsvpPanel'
import { formatCost, mapsUrl } from '@/components/events/format'
import { getEvent, getEventAttendees } from '@/lib/events'
import { createClient } from '@/lib/supabase/server'
import { cancelEvent } from '../actions'

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await createClient()
  const event = await getEvent(supabase, id)
  if (!event) notFound()
  const attendees = await getEventAttendees(supabase, id)
  const full = event.capacity !== null && event.goingCount >= event.capacity

  return (
    <main className="mx-auto max-w-md px-(--space-gutter) pb-8 pt-3">
      <Link href="/events" className="hud-label inline-flex min-h-11 items-center gap-1.5 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> All events
      </Link>

      {event.moderation === 'pending' && (
        <p role="status" className="mt-2 rounded-panel border border-[color:var(--color-super)]/50 bg-[color:var(--color-super)]/10 p-3 text-sm">
          Pending review. Only you can see this event until it’s approved.
        </p>
      )}

      <article className="glass-strong hud-frame relative mt-3 rounded-card p-(--space-card)">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {event.activityName && <span className="hud-label text-primary">// {event.activityName}</span>}
          {event.beginnerFriendly && (
            <span className="flex items-center gap-1 font-mono text-[0.6875rem] uppercase tracking-wider text-secondary-fg">
              <Sprout className="size-3.5" aria-hidden /> Beginner-friendly
            </span>
          )}
        </p>
        <h1 className="mt-2 font-display text-title font-bold uppercase leading-tight">{event.title}</h1>
        <p className="mt-2 font-mono text-sm text-fg">
          <EventWhenLine startsAt={event.startsAt} endsAt={event.endsAt} />
        </p>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex gap-3">
            <dt className="sr-only">Where</dt>
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <dd>
              <p className="font-semibold">{event.venueName}</p>
              <p className="text-muted-fg">
                {[event.address, `${event.city}, ${event.state}`].filter(Boolean).join(' · ')}
                {event.distanceMi !== null && ` · ${event.distanceMi} mi away`}
              </p>
              <a href={mapsUrl(event)} target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex min-h-11 items-center gap-1 text-primary underline-offset-4 hover:underline">
                Open in Maps <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="sr-only">Cost</dt>
            <Ticket className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <dd>{formatCost(event.costCents)}{event.capacity ? ` · ${event.capacity} spots` : ''}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="sr-only">Going</dt>
            <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <dd>
              {event.goingCount} going
              {event.buddiesGoing > 0 && <span className="text-primary"> · {event.buddiesGoing} of your matches</span>}
            </dd>
          </div>
        </dl>

        {event.description && <p className="mt-4 whitespace-pre-line leading-relaxed text-fg/90">{event.description}</p>}
        {event.url && (
          <a href={event.url} target="_blank" rel="noopener noreferrer nofollow"
            className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
            Event page <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        {event.organizerName && <p className="hud-label mt-3">Posted by {event.organizerName}</p>}
      </article>

      <section className="mt-4">
        <RsvpPanel eventId={event.id} initialGoing={event.iAmGoing} initialShowMe={event.myShowMe} full={full} />
      </section>

      <section className="mt-6" aria-labelledby="who">
        <h2 id="who" className="hud-label text-primary">// Who’s going</h2>
        {attendees.length ? (
          <ul className="mt-3 flex flex-wrap gap-4">
            {attendees.map((a) => (
              <li key={a.id} className="flex w-16 flex-col items-center gap-1 text-center">
                <Avatar url={a.photoUrl} name={a.name} size="md" ring={a.isMatch} />
                <span className="w-full truncate text-sm">{a.name}</span>
                {a.isMatch && <span className="font-mono text-[0.625rem] uppercase tracking-wider text-primary">Match</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-fg">
            Nobody has shared that they’re going yet. Turn on “Show me as going” to be the first.
          </p>
        )}
      </section>

      {event.isMine && (
        <form action={cancelEvent.bind(null, event.id)} className="mt-8">
          <button type="submit" className="min-h-11 text-sm text-danger underline-offset-4 hover:underline">
            Cancel this event
          </button>
        </form>
      )}
    </main>
  )
}

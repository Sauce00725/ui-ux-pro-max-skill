import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EventForm } from '@/components/events/EventForm'

/** The "Post an event" screen. The page fetches; this only lays out. */
export function EventNewView({
  activities,
  defaultCity,
  defaultState,
}: {
  activities: { slug: string; name: string }[]
  defaultCity: string
  defaultState: string
}) {
  return (
    <main className="mx-auto max-w-md px-(--space-gutter) pb-10 pt-3">
      <Link href="/events" className="hud-label inline-flex min-h-11 items-center gap-1.5 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Events
      </Link>
      <p className="hud-label mt-2 text-primary">// Organizer</p>
      <h1 className="font-display text-title font-bold uppercase">Post an event</h1>
      <p className="mt-1 text-sm text-muted-fg">
        Run club, open gym, pickleball night… New events are reviewed before they show up for everyone.
      </p>
      <EventForm activities={activities} defaultCity={defaultCity} defaultState={defaultState} />
    </main>
  )
}

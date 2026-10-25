import { EventsView, type EventFilters } from '@/components/events/EventsView'
import { getEvents } from '@/lib/events'
import { createClient } from '@/lib/supabase/server'
import { EVENT_RADII, EVENT_WHEN, type EventWhen } from '@/lib/validation'

export const metadata = { title: 'Events' }

type Params = { when?: string; radius?: string; activity?: string; beginner?: string }

function parse(p: Params): EventFilters {
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

  return <EventsView filters={filters} events={events} activities={activities ?? []} />
}

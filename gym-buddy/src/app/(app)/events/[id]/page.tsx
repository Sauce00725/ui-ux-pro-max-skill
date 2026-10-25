import { notFound } from 'next/navigation'
import { EventDetailView } from '@/components/events/EventDetailView'
import { getEvent, getEventAttendees } from '@/lib/events'
import { createClient } from '@/lib/supabase/server'

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await createClient()
  const event = await getEvent(supabase, id)
  if (!event) notFound()
  const attendees = await getEventAttendees(supabase, id)

  return <EventDetailView event={event} attendees={attendees} />
}

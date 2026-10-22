import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EventForm } from '@/components/events/EventForm'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Post an event' }

export default async function NewEventPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [{ data: activities }, { data: profile }] = await Promise.all([
    supabase.from('activities').select('slug, name').order('name'),
    supabase.from('profiles').select('city, state').eq('id', user!.id).single(),
  ])

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
      <EventForm activities={activities ?? []} defaultCity={profile?.city ?? ''} defaultState={profile?.state ?? ''} />
    </main>
  )
}

import { EventNewView } from '@/components/events/EventNewView'
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

  return <EventNewView activities={activities ?? []} defaultCity={profile?.city ?? ''} defaultState={profile?.state ?? ''} />
}

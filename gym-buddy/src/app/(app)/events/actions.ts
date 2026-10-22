'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { eventSchema, rsvpSchema, toFieldErrors } from '@/lib/validation'
import type { ActionResult } from '@/lib/types'

const RSVP_ERRORS: Record<string, string> = {
  event_full: 'This event is full.',
  event_over: 'This event has already happened.',
  event_not_found: 'This event is no longer available.',
}

/** Going / not going, and whether other members can see you're going. */
export async function setRsvp(input: unknown): Promise<ActionResult> {
  const parsed = rsvpSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid RSVP.' }
  const { eventId, going, showMe } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Your session expired. Log in again.' }

  const { error } = going
    ? await supabase
        .from('event_rsvps')
        .upsert({ event_id: eventId, user_id: user.id, show_me: showMe }, { onConflict: 'event_id,user_id' })
    : await supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', user.id)

  if (error) {
    const known = Object.keys(RSVP_ERRORS).find((k) => error.message.includes(k))
    if (!known) console.error('[rsvp]', error.message)
    return { ok: false, message: known ? RSVP_ERRORS[known] : 'Couldn’t update your RSVP. Try again.' }
  }
  revalidatePath('/events')
  revalidatePath(`/events/${eventId}`)
  return { ok: true }
}

export async function createEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = eventSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: toFieldErrors(parsed.error) }
  }
  const v = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/events/new')

  // Venue coordinates: from the browser if shared, otherwise the organizer's saved (~1 km) location.
  let { lat, lng } = v
  if (lat === null || lng === null) {
    const { data } = await supabase.rpc('my_location').maybeSingle<{ lat: number; lng: number }>()
    if (!data) return { ok: false, message: 'Share the venue location so people nearby can find it.' }
    ;({ lat, lng } = data)
  }

  let activityId: number | null = null
  if (v.activitySlug) {
    const { data } = await supabase.from('activities').select('id').eq('slug', v.activitySlug).maybeSingle()
    activityId = data?.id ?? null
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      organizer_id: user.id,
      activity_id: activityId,
      title: v.title,
      description: v.description || null,
      starts_at: v.startsAt,
      ends_at: v.endsAt,
      venue_name: v.venueName,
      address: v.address || null,
      city: v.city,
      state: v.state,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      url: v.url || null,
      beginner_friendly: v.beginnerFriendly,
      cost_cents: Math.round(v.costDollars * 100),
      capacity: v.capacity,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[createEvent]', error?.message)
    return { ok: false, message: 'Couldn’t post your event. Try again.' }
  }
  revalidatePath('/events')
  return { ok: true, data: { id: data.id } }
}

export async function cancelEvent(eventId: string) {
  const id = z.string().uuid().parse(eventId)
  const supabase = await createClient()
  await supabase.from('events').delete().eq('id', id) // RLS: organizer only
  revalidatePath('/events')
  redirect('/events')
}

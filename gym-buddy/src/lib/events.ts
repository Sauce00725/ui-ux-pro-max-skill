import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { signPhotoUrls } from './discovery'
import type { EventAttendee, EventItem } from './types'
import type { EventWhen } from './validation'

interface EventRow {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  venue_name: string
  address: string | null
  city: string
  state: string
  url: string | null
  beginner_friendly: boolean
  cost_cents: number
  capacity: number | null
  activity_slug: string | null
  activity_name: string | null
  distance_mi: number | null
  going_count: number
  buddies_going: number
  i_am_going: boolean
  my_show_me: boolean
  is_mine: boolean
  moderation: EventItem['moderation']
  organizer_name: string | null
}

const toEvent = (r: EventRow): EventItem => ({
  id: r.id,
  title: r.title,
  description: r.description,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  venueName: r.venue_name,
  address: r.address,
  city: r.city,
  state: r.state,
  url: r.url,
  beginnerFriendly: r.beginner_friendly,
  costCents: r.cost_cents,
  capacity: r.capacity,
  activitySlug: r.activity_slug,
  activityName: r.activity_name,
  distanceMi: r.distance_mi === null ? null : Number(r.distance_mi),
  goingCount: r.going_count,
  buddiesGoing: r.buddies_going,
  iAmGoing: r.i_am_going,
  myShowMe: r.my_show_me,
  isMine: r.is_mine,
  moderation: r.moderation,
  organizerName: r.organizer_name,
})

/** Date window for a "when" filter, in server time (good enough for a 1–30 day window). */
export function windowFor(when: EventWhen, now = new Date()) {
  const from = new Date(now)
  const to = new Date(now)
  if (when === 'week') to.setDate(to.getDate() + 7)
  else if (when === 'month') to.setDate(to.getDate() + 30)
  else {
    // This weekend: from Saturday 00:00 (or now, if it's already the weekend) to Sunday 23:59.
    const day = now.getDay() // 0 Sun … 6 Sat
    const toSat = day === 0 ? -1 : 6 - day
    const sat = new Date(now)
    sat.setDate(now.getDate() + toSat)
    sat.setHours(0, 0, 0, 0)
    if (sat > now) from.setTime(sat.getTime())
    to.setTime(sat.getTime())
    to.setDate(sat.getDate() + 1)
    to.setHours(23, 59, 59, 999)
  }
  return { from: from.toISOString(), to: to.toISOString() }
}

export async function getEvents(
  supabase: SupabaseClient,
  f: { radiusMi: number; activity: string | null; when: EventWhen; beginner: boolean },
): Promise<EventItem[]> {
  const { from, to } = windowFor(f.when)
  const { data, error } = await supabase.rpc('get_events', {
    p_radius_mi: f.radiusMi,
    p_activity: f.activity,
    p_from: from,
    p_to: to,
    p_beginner: f.beginner,
  })
  if (error) throw new Error(`get_events failed: ${error.message}`)
  return ((data ?? []) as EventRow[]).map(toEvent)
}

export async function getEvent(supabase: SupabaseClient, id: string): Promise<EventItem | null> {
  const { data, error } = await supabase.rpc('get_events', { p_event_id: id })
  if (error) throw new Error(`get_events failed: ${error.message}`)
  const row = ((data ?? []) as EventRow[])[0]
  return row ? toEvent(row) : null
}

export async function getEventAttendees(supabase: SupabaseClient, id: string): Promise<EventAttendee[]> {
  const { data, error } = await supabase.rpc('get_event_attendees', { p_event_id: id })
  if (error) throw new Error(`get_event_attendees failed: ${error.message}`)
  const rows = (data ?? []) as { user_id: string; display_name: string; photo_path: string | null; is_match: boolean }[]
  const urls = await signPhotoUrls(supabase, rows.flatMap((r) => (r.photo_path ? [r.photo_path] : [])))
  return rows.map((r) => ({
    id: r.user_id,
    name: r.display_name,
    photoUrl: r.photo_path ? urls.get(r.photo_path) : undefined,
    isMatch: r.is_match,
  }))
}

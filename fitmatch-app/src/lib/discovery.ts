import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppMode, DiscoveryCard, Selection, SwipeQuota } from './types'

interface DiscoveryRow {
  user_id: string
  display_name: string
  age: number
  city: string | null
  state: string | null
  bio: string | null
  headline: string | null
  fitness_level: number | null
  training_times: string[]
  is_verified: boolean
  distance_mi: number
  shared_activities: string[]
  other_activities: string[]
  photo_paths: string[]
  goals: string[]
  shared_goals: string[]
  helps_beginners: boolean
}

const PHOTOS_PER_CARD = 4

/**
 * Feed for the signed-in user. All filtering and ranking happens in the
 * `get_discovery` Postgres function (mutual age/distance/gender prefs, already
 * swiped, blocked, passed-on-me, approved photo; ranking by shared activities
 * and goals, beginner ↔ helper fit), so this only signs photo URLs.
 */
export async function getDiscoveryFeed(supabase: SupabaseClient, mode: AppMode, limit = 20): Promise<DiscoveryCard[]> {
  const { data, error } = await supabase.rpc('get_discovery', { p_mode: mode, p_limit: limit })
  if (error) throw new Error(`get_discovery failed: ${error.message}`)

  const rows = (data ?? []) as DiscoveryRow[]
  const urls = await signPhotoUrls(supabase, rows.flatMap((r) => r.photo_paths.slice(0, PHOTOS_PER_CARD)))

  return rows.map((r) => ({
    id: r.user_id,
    name: r.display_name,
    age: r.age,
    city: r.city,
    state: r.state,
    bio: r.bio,
    headline: r.headline,
    fitnessLevel: r.fitness_level,
    trainingTimes: r.training_times,
    isVerified: r.is_verified,
    distanceMi: r.distance_mi,
    sharedActivities: r.shared_activities,
    otherActivities: r.other_activities,
    photos: r.photo_paths
      .slice(0, PHOTOS_PER_CARD)
      .map((p) => urls.get(p))
      .filter((u): u is string => !!u),
    goals: r.goals,
    sharedGoals: r.shared_goals,
    helpsBeginners: r.helps_beginners,
  }))
}

/** Photos live in a private bucket; hand the browser short-lived signed URLs. */
export async function signPhotoUrls(supabase: SupabaseClient, paths: string[], expiresIn = 3600) {
  const map = new Map<string, string>()
  if (!paths.length) return map
  const { data } = await supabase.storage.from('photos').createSignedUrls(paths, expiresIn)
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl)
  }
  return map
}

export async function getSwipeQuota(supabase: SupabaseClient, mode: AppMode): Promise<SwipeQuota> {
  const { data, error } = await supabase.rpc('get_swipe_quota', { p_mode: mode }).single<{
    remaining: number
    swipe_limit: number
    window_seconds: number
    resets_at: string | null
  }>()
  if (error || !data) throw new Error(`get_swipe_quota failed: ${error?.message}`)
  return {
    remaining: data.remaining,
    limit: data.swipe_limit,
    windowSeconds: data.window_seconds,
    resetsAt: data.resets_at,
  }
}

/**
 * The user's current Daily Selection: never more cards than swipes left in
 * this window, so the deck *is* the allowance.
 */
export async function getSelection(supabase: SupabaseClient, mode: AppMode): Promise<Selection> {
  const quota = await getSwipeQuota(supabase, mode)
  const cards = quota.remaining > 0 ? await getDiscoveryFeed(supabase, mode, quota.remaining) : []
  return { cards, quota }
}

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppMode, DiscoveryCard, LikeReceived, ProfilePrompt, Selection, SuperQuota, SwipeQuota } from './types'

/** Columns shared by get_discovery and get_likes_received. */
interface CardRow {
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
  photo_ids: string[]
  prompts: ProfilePrompt[]
  goals: string[]
  shared_goals: string[]
  helps_beginners: boolean
  super_liked_me?: boolean
}

interface LikeRow extends CardRow {
  liked_at: string
  is_super: boolean
  comment: string | null
  liked_photo_id: string | null
  liked_prompt_key: string | null
  liked_prompt_answer: string | null
}

const PHOTOS_PER_CARD = 4

const cardPaths = (r: CardRow) => r.photo_paths.slice(0, PHOTOS_PER_CARD)

function toCard(r: CardRow, urls: Map<string, string>): DiscoveryCard {
  // Keep photo URLs and ids aligned even if a signed URL failed.
  const photos = cardPaths(r)
    .map((path, i) => ({ url: urls.get(path), id: r.photo_ids[i] }))
    .filter((p): p is { url: string; id: string } => !!p.url && !!p.id)

  return {
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
    photos: photos.map((p) => p.url),
    photoIds: photos.map((p) => p.id),
    prompts: r.prompts ?? [],
    goals: r.goals,
    sharedGoals: r.shared_goals,
    helpsBeginners: r.helps_beginners,
    superLikedMe: r.super_liked_me ?? false,
  }
}

/**
 * Feed for the signed-in user. All filtering and ranking happens in the
 * `get_discovery` Postgres function (mutual age/distance/gender prefs, already
 * swiped, blocked, passed-on-me, approved photo; ranking by Super Likes,
 * shared activities and goals, beginner ↔ helper fit), so this only signs photo URLs.
 */
export async function getDiscoveryFeed(supabase: SupabaseClient, mode: AppMode, limit = 20): Promise<DiscoveryCard[]> {
  const { data, error } = await supabase.rpc('get_discovery', { p_mode: mode, p_limit: limit })
  if (error) throw new Error(`get_discovery failed: ${error.message}`)

  const rows = (data ?? []) as CardRow[]
  const urls = await signPhotoUrls(supabase, rows.flatMap(cardPaths))
  return rows.map((r) => toCard(r, urls))
}

/** Hinge-style "Likes you": pending likes, Super Likes first. */
export async function getLikesReceived(supabase: SupabaseClient, mode: AppMode): Promise<LikeReceived[]> {
  const { data, error } = await supabase.rpc('get_likes_received', { p_mode: mode })
  if (error) throw new Error(`get_likes_received failed: ${error.message}`)
  const rows = (data ?? []) as LikeRow[]

  // The liked photo is one of *my* photos; resolve its path (own rows are readable).
  const likedIds = [...new Set(rows.map((r) => r.liked_photo_id).filter((id): id is string => !!id))]
  const { data: mine } = likedIds.length
    ? await supabase.from('photos').select('id, storage_path').in('id', likedIds)
    : { data: [] as { id: string; storage_path: string }[] }
  const likedPath = new Map((mine ?? []).map((p) => [p.id, p.storage_path]))

  const urls = await signPhotoUrls(supabase, [...rows.flatMap(cardPaths), ...likedPath.values()])

  return rows.map((r) => {
    const path = r.liked_photo_id ? likedPath.get(r.liked_photo_id) : undefined
    return {
      ...toCard(r, urls),
      likedAt: r.liked_at,
      isSuper: r.is_super,
      comment: r.comment,
      likedPhotoUrl: path ? (urls.get(path) ?? null) : null,
      likedPrompt: r.liked_prompt_key ? { key: r.liked_prompt_key, answer: r.liked_prompt_answer ?? '' } : null,
    }
  })
}

/** Photos live in a private bucket; hand the browser short-lived signed URLs. */
export async function signPhotoUrls(supabase: SupabaseClient, paths: string[], expiresIn = 3600) {
  const map = new Map<string, string>()
  if (!paths.length) return map
  const { data } = await supabase.storage.from('photos').createSignedUrls([...new Set(paths)], expiresIn)
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

export async function getSuperQuota(supabase: SupabaseClient, mode: AppMode): Promise<SuperQuota> {
  const { data, error } = await supabase
    .rpc('get_super_quota', { p_mode: mode })
    .single<{ remaining: number; resets_at: string | null }>()
  if (error || !data) throw new Error(`get_super_quota failed: ${error?.message}`)
  return { remaining: data.remaining, resetsAt: data.resets_at }
}

/**
 * The user's current Daily Selection: never more cards than swipes left in
 * this window, so the deck *is* the allowance.
 */
export async function getSelection(supabase: SupabaseClient, mode: AppMode): Promise<Selection> {
  const [quota, superQuota] = await Promise.all([getSwipeQuota(supabase, mode), getSuperQuota(supabase, mode)])
  const cards = quota.remaining > 0 ? await getDiscoveryFeed(supabase, mode, quota.remaining) : []
  return { cards, quota, superQuota }
}

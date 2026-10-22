import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModePrefs, PromptKey } from './validation'

/*
 * Profile writes shared by onboarding (all at once) and Settings (one section
 * at a time). Each one is idempotent so a retry after a partial failure is safe.
 * They return the Supabase error (or null) for the caller to report.
 */

type Db = SupabaseClient
type Result = { message: string } | null

/** ~1 km precision. We never need (or want) exact coordinates. */
const fuzz = (n: number) => Math.round(n * 100) / 100

export async function updateProfile(db: Db, userId: string, fields: Record<string, unknown>): Promise<Result> {
  const { error } = await db.from('profiles').update(fields).eq('id', userId)
  return error
}

export async function replaceActivities(db: Db, userId: string, activityIds: number[]): Promise<Result> {
  const { error: delError } = await db.from('profile_activities').delete().eq('user_id', userId)
  if (delError) return delError
  if (!activityIds.length) return null
  const { error } = await db
    .from('profile_activities')
    .insert(activityIds.map((activity_id) => ({ user_id: userId, activity_id })))
  return error
}

export async function replacePrompts(db: Db, userId: string, prompts: { key: PromptKey; answer: string }[]): Promise<Result> {
  const { error: delError } = await db.from('profile_prompts').delete().eq('user_id', userId)
  if (delError) return delError
  if (!prompts.length) return null
  const { error } = await db
    .from('profile_prompts')
    .insert(prompts.map((p, position) => ({ user_id: userId, prompt_key: p.key, answer: p.answer, position })))
  return error
}

export async function writeLocation(db: Db, userId: string, lat: number, lng: number): Promise<Result> {
  const { error } = await db.from('user_locations').upsert({
    user_id: userId,
    location: `SRID=4326;POINT(${fuzz(lng)} ${fuzz(lat)})`,
    updated_at: new Date().toISOString(),
  })
  return error
}

export async function writeModes(db: Db, userId: string, modes: { buddy: ModePrefs; dating: ModePrefs }): Promise<Result> {
  const { error } = await db.from('profile_modes').upsert(
    (['buddy', 'dating'] as const).map((mode) => {
      const m = modes[mode]
      return {
        user_id: userId,
        mode,
        is_active: m.enabled,
        headline: m.headline || null,
        min_age: m.minAge,
        max_age: m.maxAge,
        max_distance_mi: m.maxDistanceMi,
        interested_in: m.interestedIn,
      }
    }),
    { onConflict: 'user_id,mode' },
  )
  return error
}

/**
 * Make the user's photo set exactly `paths`, in order. New paths become
 * 'pending' rows; removed ones are deleted (rows and storage objects);
 * everything gets its new position.
 */
export async function syncPhotos(db: Db, userId: string, paths: string[]): Promise<Result> {
  const { data: existing, error: readError } = await db.from('photos').select('id, storage_path').eq('user_id', userId)
  if (readError) return readError

  const keep = new Set(paths)
  const removed = (existing ?? []).filter((p) => !keep.has(p.storage_path))
  if (removed.length) {
    const { error } = await db.from('photos').delete().in('id', removed.map((p) => p.id))
    if (error) return error
    await db.storage.from('photos').remove(removed.map((p) => p.storage_path))
  }

  const known = new Set((existing ?? []).map((p) => p.storage_path))
  const added = paths.filter((p) => !known.has(p))
  if (added.length) {
    const { error } = await db
      .from('photos')
      .insert(added.map((storage_path) => ({ user_id: userId, storage_path, position: paths.indexOf(storage_path) })))
    if (error) return error
  }

  // Positions for kept photos (only the user's own rows are visible/updatable).
  for (const [position, storage_path] of paths.entries()) {
    if (!known.has(storage_path)) continue
    const { error } = await db.from('photos').update({ position }).eq('user_id', userId).eq('storage_path', storage_path)
    if (error) return error
  }
  return null
}

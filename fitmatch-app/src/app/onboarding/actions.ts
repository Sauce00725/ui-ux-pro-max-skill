'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { onboardingSchema, toFieldErrors } from '@/lib/validation'
import type { ActionResult } from '@/lib/types'

/** ~1 km precision. We never need (or want) exact coordinates. */
const fuzz = (n: number) => Math.round(n * 100) / 100

/**
 * Saves the whole onboarding form. Every step is idempotent, so a retry after
 * a partial failure is safe. profile_modes is written last: its existence is
 * what marks onboarding as complete (see the (app) layout guard).
 */
export async function completeOnboarding(input: unknown): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: toFieldErrors(parsed.error) }
  }
  const v = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/onboarding')

  if (v.photoPaths.some((p) => !p.startsWith(`${user.id}/`))) {
    return { ok: false, message: 'One of your photos is invalid. Remove it and upload again.' }
  }

  const fail = (step: string, error: { message: string }) => {
    console.error(`[onboarding] ${step}:`, error.message)
    return { ok: false as const, message: 'Something went wrong saving your profile. Please try again.' }
  }

  // 1. Profile (insert, or update on retry; upsert would need UPDATE on `id`)
  const profile = {
    display_name: v.displayName,
    birthdate: v.birthdate,
    gender: v.gender,
    bio: v.bio || null,
    city: v.city,
    state: v.state,
    fitness_level: v.fitnessLevel,
    training_times: v.trainingTimes,
  }
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  const { error: profileError } = existing
    ? await supabase.from('profiles').update(profile).eq('id', user.id)
    : await supabase.from('profiles').insert({ id: user.id, ...profile })
  if (profileError) return fail('profile', profileError)

  // 2. Activities (replace the set)
  const { error: delError } = await supabase.from('profile_activities').delete().eq('user_id', user.id)
  if (delError) return fail('activities', delError)
  const { error: actError } = await supabase
    .from('profile_activities')
    .insert(v.activityIds.map((activity_id) => ({ user_id: user.id, activity_id })))
  if (actError) return fail('activities', actError)

  // 3. Photos (already in storage; rows start as 'pending' moderation)
  const { error: photoError } = await supabase.from('photos').upsert(
    v.photoPaths.map((storage_path, position) => ({ user_id: user.id, storage_path, position })),
    { onConflict: 'storage_path', ignoreDuplicates: true },
  )
  if (photoError) return fail('photos', photoError)

  // 4. Location (owner-only table)
  const { error: locError } = await supabase.from('user_locations').upsert({
    user_id: user.id,
    location: `SRID=4326;POINT(${fuzz(v.lng)} ${fuzz(v.lat)})`,
    updated_at: new Date().toISOString(),
  })
  if (locError) return fail('location', locError)

  // 5. Modes, last
  const { error: modeError } = await supabase.from('profile_modes').upsert(
    (['buddy', 'dating'] as const).map((mode) => {
      const m = v.modes[mode]
      return {
        user_id: user.id,
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
  if (modeError) return fail('modes', modeError)

  redirect(`/discover?mode=${v.modes.buddy.enabled ? 'buddy' : 'dating'}`)
}

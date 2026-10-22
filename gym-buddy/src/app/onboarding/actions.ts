'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { replaceActivities, replacePrompts, syncPhotos, updateProfile, writeLocation, writeModes } from '@/lib/profile-writes'
import { onboardingSchema, toFieldErrors } from '@/lib/validation'
import type { ActionResult } from '@/lib/types'

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
    goals: v.goals,
    helps_beginners: v.helpsBeginners,
  }
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  const profileError = existing
    ? await updateProfile(supabase, user.id, profile)
    : (await supabase.from('profiles').insert({ id: user.id, ...profile })).error
  if (profileError) return fail('profile', profileError)

  // 2–5. Activities, photos, prompts, location
  const activitiesError = await replaceActivities(supabase, user.id, v.activityIds)
  if (activitiesError) return fail('activities', activitiesError)
  const photosError = await syncPhotos(supabase, user.id, v.photoPaths)
  if (photosError) return fail('photos', photosError)
  const promptsError = await replacePrompts(supabase, user.id, v.prompts)
  if (promptsError) return fail('prompts', promptsError)
  const locationError = await writeLocation(supabase, user.id, v.lat, v.lng)
  if (locationError) return fail('location', locationError)

  // 6. Modes, last
  const modesError = await writeModes(supabase, user.id, v.modes)
  if (modesError) return fail('modes', modesError)

  redirect(`/discover?mode=${v.modes.buddy.enabled ? 'buddy' : 'dating'}`)
}

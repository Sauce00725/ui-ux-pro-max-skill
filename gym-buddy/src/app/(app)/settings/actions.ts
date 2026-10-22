'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { replaceActivities, replacePrompts, syncPhotos, updateProfile, writeLocation, writeModes } from '@/lib/profile-writes'
import {
  fitnessSchema,
  modesSchema,
  photosSchema,
  promptsSchema,
  settingsBasicsSchema,
  toFieldErrors,
} from '@/lib/validation'
import type { ActionResult } from '@/lib/types'
import type { z } from 'zod'

/*
 * One action per Settings section. Each validates with the same schema as
 * onboarding and writes through the shared profile writers.
 */

async function withUser<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
  write: (db: Awaited<ReturnType<typeof createClient>>, userId: string, v: z.infer<S>) => Promise<{ message: string } | null | string>,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: toFieldErrors(parsed.error) }
  }
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { ok: false, message: 'Your session expired. Log in again.' }

  const error = await write(db, user.id, parsed.data)
  if (typeof error === 'string') return { ok: false, message: error }
  if (error) {
    console.error('[settings]', error.message)
    return { ok: false, message: 'Couldn’t save. Try again.' }
  }
  revalidatePath('/settings')
  revalidatePath('/discover')
  return { ok: true }
}

export async function saveBasics(input: unknown) {
  return withUser(settingsBasicsSchema, input, async (db, id, v) => {
    const err = await updateProfile(db, id, {
      display_name: v.displayName,
      gender: v.gender,
      bio: v.bio || null,
      city: v.city,
      state: v.state,
    })
    if (err) return err
    return v.lat !== null && v.lng !== null ? writeLocation(db, id, v.lat, v.lng) : null
  })
}

export async function saveFitness(input: unknown) {
  return withUser(fitnessSchema, input, async (db, id, v) => {
    const err = await updateProfile(db, id, {
      fitness_level: v.fitnessLevel,
      training_times: v.trainingTimes,
      goals: v.goals,
      helps_beginners: v.helpsBeginners,
    })
    return err ?? replaceActivities(db, id, v.activityIds)
  })
}

export async function savePrompts(input: unknown) {
  return withUser(promptsSchema, input, (db, id, v) => replacePrompts(db, id, v.prompts))
}

export async function saveModes(input: unknown) {
  return withUser(modesSchema, input, (db, id, v) => writeModes(db, id, v.modes))
}

export async function savePhotos(input: unknown) {
  return withUser(photosSchema, input, async (db, id, v) => {
    if (v.photoPaths.some((p) => !p.startsWith(`${id}/`))) return 'One of your photos is invalid. Remove it and upload again.'
    return syncPhotos(db, id, v.photoPaths)
  })
}

export async function setPaused(paused: boolean): Promise<ActionResult> {
  const db = await createClient()
  const { error } = await db.rpc('set_profile_paused', { p_paused: paused === true })
  if (error) return { ok: false, message: 'Couldn’t update. Try again.' }
  revalidatePath('/settings')
  return { ok: true }
}

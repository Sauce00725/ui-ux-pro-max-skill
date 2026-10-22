'use server'

import { createClient } from '@/lib/supabase/server'
import { getSelection, getSuperQuota, getSwipeQuota } from '@/lib/discovery'
import { swipeSchema } from '@/lib/validation'
import type { ActionResult, AppMode, Selection, SwipeResult } from '@/lib/types'

/**
 * One swipe: like, pass or Super Like, optionally pointing at a photo/prompt
 * with a comment (Hinge-style). Also used to answer likes from the Likes tab.
 */
export async function swipe(input: unknown): Promise<SwipeResult> {
  const parsed = swipeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'error', message: 'Invalid swipe.' }
  const { targetId, mode, action, super: isSuper, comment, photoId, promptId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'error', message: 'Your session expired. Log in again.' }

  // BEFORE triggers enforce the selection + Super Like limits and validate the
  // liked item; the AFTER trigger creates the match (and seeds the chat) if mutual.
  const { error } = await supabase.from('swipes').insert({
    swiper_id: user.id,
    swiped_id: targetId,
    mode,
    action,
    is_super: isSuper,
    comment: comment || null,
    liked_photo_id: photoId ?? null,
    liked_prompt_id: promptId ?? null,
  })

  if (error?.message.includes('swipe_limit_reached')) {
    const [quota, superQuota] = await Promise.all([getSwipeQuota(supabase, mode), getSuperQuota(supabase, mode)])
    return { ok: false, reason: 'limit', message: 'That’s your selection for now.', quota, superQuota }
  }
  if (error?.message.includes('superlike_limit_reached')) {
    const [quota, superQuota] = await Promise.all([getSwipeQuota(supabase, mode), getSuperQuota(supabase, mode)])
    return { ok: false, reason: 'super-limit', message: 'You’ve used today’s Super Like.', quota, superQuota }
  }
  // 23505 = already swiped (double tap / second tab): treat as success.
  if (error && error.code !== '23505') {
    console.error('[swipe]', error.message)
    return { ok: false, reason: 'error', message: 'Couldn’t save that. Try again.' }
  }

  const [a, b] = [user.id, targetId].sort()
  const [quota, superQuota, match] = await Promise.all([
    getSwipeQuota(supabase, mode),
    getSuperQuota(supabase, mode),
    action === 'like'
      ? supabase.from('matches').select('id').eq('user_a', a).eq('user_b', b).eq('mode', mode).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return { ok: true, matchId: match.data?.id ?? null, quota, superQuota }
}

/** Fresh selection: used when a window refills or the user taps refresh. */
export async function refreshSelection(mode: AppMode): Promise<Selection> {
  const supabase = await createClient()
  return getSelection(supabase, mode === 'dating' ? 'dating' : 'buddy')
}

export async function enableMode(mode: AppMode): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Your session expired. Log in again.' }

  const { error } = await supabase
    .from('profile_modes')
    .upsert({ user_id: user.id, mode, is_active: true }, { onConflict: 'user_id,mode' })
  return error ? { ok: false, message: 'Couldn’t turn that on. Try again.' } : { ok: true }
}

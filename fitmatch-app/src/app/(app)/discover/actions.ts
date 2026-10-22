'use server'

import { createClient } from '@/lib/supabase/server'
import { getDiscoveryFeed } from '@/lib/discovery'
import { swipeSchema } from '@/lib/validation'
import type { ActionResult, AppMode, DiscoveryCard } from '@/lib/types'

export async function swipe(input: unknown): Promise<ActionResult<{ matchId: string | null }>> {
  const parsed = swipeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Invalid swipe.' }
  const { targetId, mode, action } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Your session expired. Log in again.' }

  // The on_swipe trigger creates the match if this like is mutual.
  const { error } = await supabase
    .from('swipes')
    .insert({ swiper_id: user.id, swiped_id: targetId, mode, action })

  // 23505 = already swiped (double tap / second tab): treat as success.
  if (error && error.code !== '23505') {
    console.error('[swipe]', error.message)
    return { ok: false, message: 'Couldn’t save that. Try again.' }
  }
  if (action === 'pass') return { ok: true, data: { matchId: null } }

  const [a, b] = [user.id, targetId].sort()
  const { data: match } = await supabase
    .from('matches')
    .select('id')
    .eq('user_a', a)
    .eq('user_b', b)
    .eq('mode', mode)
    .maybeSingle()

  return { ok: true, data: { matchId: match?.id ?? null } }
}

export async function loadMore(mode: AppMode): Promise<DiscoveryCard[]> {
  const supabase = await createClient()
  // Already-swiped profiles are excluded server-side, so "more" is just a refetch.
  return getDiscoveryFeed(supabase, mode === 'dating' ? 'dating' : 'buddy')
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

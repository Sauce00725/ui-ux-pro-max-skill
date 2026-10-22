'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { reportSchema } from '@/lib/validation'
import type { ActionResult } from '@/lib/types'

async function getOtherUser(matchId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS: only returns the row if the caller is a participant.
  const { data: match } = await supabase.from('matches').select('user_a, user_b').eq('id', matchId).maybeSingle()
  if (!match) return null
  return { supabase, me: user.id, otherId: match.user_a === user.id ? match.user_b : match.user_a }
}

export async function unmatch(matchId: string) {
  const id = z.string().uuid().parse(matchId)
  const supabase = await createClient()
  await supabase.rpc('unmatch', { p_match_id: id })
  redirect('/matches')
}

/** Blocking also unmatches, and hides each person from the other's feeds. */
export async function blockUser(matchId: string) {
  const id = z.string().uuid().parse(matchId)
  const ctx = await getOtherUser(id)
  if (!ctx) redirect('/matches')

  await ctx.supabase.from('blocks').upsert({ blocker_id: ctx.me, blocked_id: ctx.otherId }, { ignoreDuplicates: true })
  await ctx.supabase.rpc('unmatch', { p_match_id: id })
  redirect('/matches')
}

export async function reportUser(input: unknown): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Choose a reason.' }

  const ctx = await getOtherUser(parsed.data.matchId)
  if (!ctx) return { ok: false, message: 'This conversation no longer exists.' }

  const { error } = await ctx.supabase.from('reports').insert({
    reporter_id: ctx.me,
    reported_id: ctx.otherId,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
  })
  if (error) return { ok: false, message: 'Couldn’t send your report. Try again.' }

  // Reporting always protects the reporter right away.
  await ctx.supabase.from('blocks').upsert({ blocker_id: ctx.me, blocked_id: ctx.otherId }, { ignoreDuplicates: true })
  await ctx.supabase.rpc('unmatch', { p_match_id: parsed.data.matchId })
  return { ok: true }
}

import type { ActionResult } from '@/lib/types'
import { bus } from '../bus'
import { unmatch as unmatchInWorld } from '../demo/world'

export async function unmatch(matchId: string) {
  unmatchInWorld(matchId)
  bus.navigate('/matches', { replace: true })
}
export async function blockUser(matchId: string) {
  unmatchInWorld(matchId)
  bus.navigate('/matches', { replace: true })
}
/** A report also blocks them (as in the real action), so the match goes away. */
export async function reportUser(input: unknown): Promise<ActionResult> {
  await new Promise((r) => setTimeout(r, 400))
  const { matchId } = input as { matchId?: string }
  if (matchId) unmatchInWorld(matchId)
  return { ok: true }
}

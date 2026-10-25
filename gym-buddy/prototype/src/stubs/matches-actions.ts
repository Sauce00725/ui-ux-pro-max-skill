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
export async function reportUser(_input: unknown): Promise<ActionResult> {
  await new Promise((r) => setTimeout(r, 400))
  return { ok: true }
}

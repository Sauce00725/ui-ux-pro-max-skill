import type { AppMode, ActionResult, Selection, SwipeResult } from '@/lib/types'
import { selection, swipe as swipeInWorld } from '../demo/world'

// Same signatures as src/app/(app)/discover/actions.ts, answered by the demo world.
export const swipe = (input: unknown): Promise<SwipeResult> => swipeInWorld(input)
export async function refreshSelection(mode: AppMode): Promise<Selection> {
  await new Promise((r) => setTimeout(r, 350))
  return selection(mode)
}
export async function enableMode(_mode: AppMode): Promise<ActionResult> {
  return { ok: true }
}

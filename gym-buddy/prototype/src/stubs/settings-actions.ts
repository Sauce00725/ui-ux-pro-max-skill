import type { ActionResult } from '@/lib/types'
import { setPaused as pauseInWorld } from '../demo/world'

// The prototype keeps no profile: every section "saves" after a beat.
const saved = async (): Promise<ActionResult> => {
  await new Promise((r) => setTimeout(r, 450))
  return { ok: true }
}
export const saveBasics = (_input: unknown) => saved()
export const saveFitness = (_input: unknown) => saved()
export const savePrompts = (_input: unknown) => saved()
export const saveModes = (_input: unknown) => saved()
export const savePhotos = (_input: unknown) => saved()
export async function setPaused(paused: boolean): Promise<ActionResult> {
  pauseInWorld(paused)
  return saved()
}

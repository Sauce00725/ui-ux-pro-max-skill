import type { ActionResult } from '@/lib/types'
import { bus } from '../bus'
import { addEvent, cancelEvent as cancelInWorld, setRsvp as rsvpInWorld } from '../demo/world'

export async function setRsvp(input: unknown): Promise<ActionResult> {
  const { eventId, going, showMe } = input as { eventId: string; going: boolean; showMe: boolean }
  await new Promise((r) => setTimeout(r, 250))
  rsvpInWorld(eventId, going, showMe)
  return { ok: true }
}

export async function createEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  await new Promise((r) => setTimeout(r, 500))
  return { ok: true, data: { id: addEvent(input as Parameters<typeof addEvent>[0]) } }
}

export async function cancelEvent(eventId: string) {
  cancelInWorld(eventId)
  bus.navigate('/events', { replace: true })
}

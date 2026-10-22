/*
 * Event date/price formatting. Runs in the browser (see LocalTime / EventList)
 * so times show in the viewer's own timezone, which for nearby events is the
 * event's timezone too.
 */

export function formatCost(cents: number) {
  if (cents === 0) return 'Free'
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`
}

export function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export function timeRange(startIso: string, endIso: string | null) {
  const start = new Date(startIso)
  if (!endIso) return time(start)
  return `${time(start)} – ${time(new Date(endIso))}`
}

export function dateBlock(iso: string) {
  const d = new Date(iso)
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleDateString(undefined, { month: 'short' }),
  }
}

export const mapsUrl = (e: { venueName: string; address: string | null; city: string; state: string }) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [e.venueName, e.address, `${e.city}, ${e.state}`].filter(Boolean).join(', '),
  )}`

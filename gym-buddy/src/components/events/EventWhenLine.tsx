'use client'

import { useMounted } from '@/components/useMounted'
import { dayLabel, timeRange } from './format'

/** "Tomorrow · 6:30 AM – 7:30 AM", in the viewer's timezone (so it waits for the browser). */
export function EventWhenLine({ startsAt, endsAt }: { startsAt: string; endsAt: string | null }) {
  const mounted = useMounted()
  return <time dateTime={startsAt}>{mounted ? `${dayLabel(startsAt)} · ${timeRange(startsAt, endsAt)}` : ' '}</time>
}

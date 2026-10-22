'use client'

import { useEffect, useState } from 'react'
import { dayLabel, timeRange } from './format'

export function EventWhenLine({ startsAt, endsAt }: { startsAt: string; endsAt: string | null }) {
  const [text, setText] = useState<string>()
  useEffect(() => setText(`${dayLabel(startsAt)} · ${timeRange(startsAt, endsAt)}`), [startsAt, endsAt])
  return <time dateTime={startsAt}>{text ?? ' '}</time>
}

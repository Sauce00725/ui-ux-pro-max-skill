'use client'

import { useEffect, useState } from 'react'
import type { SwipeQuota } from '@/lib/types'

// Ring geometry, in viewBox units (the ring renders at 56px).
const SIZE = 56
const R = 22.5
const STROKE = 3.5
const GAP = 4.5 // visible gap between cells
const C = 2 * Math.PI * R

/**
 * Tachometer: one cell per pick in this selection, clockwise from 12
 * o'clock, draining from the end as you swipe. The count sits in the middle
 * and rolls like an odometer; the pick you just spent burns out hot.
 */
export function QuotaMeter({ quota }: { quota: SwipeQuota }) {
  const seg = C / Math.max(quota.limit, 1)
  // Round caps add half a stroke at each end, so take a full stroke off the dash.
  const dash = Math.max(0.01, seg - GAP - STROKE)
  const cells = Array.from({ length: quota.limit }, (_, i) => ({
    i,
    strokeDasharray: `${dash} ${C - dash}`,
    strokeDashoffset: -(i * seg + (GAP + STROKE) / 2),
  }))
  const circle = { cx: SIZE / 2, cy: SIZE / 2, r: R }

  // Which cell was just spent: the one at the new `remaining`. Derived while rendering
  // (the documented pattern for "state that follows a prop change"), so the cell
  // lights its burn on the very frame it empties.
  const [seen, setSeen] = useState(quota.remaining)
  const [spent, setSpent] = useState(-1)
  if (seen !== quota.remaining) {
    setSpent(quota.remaining < seen ? quota.remaining : -1)
    setSeen(quota.remaining)
  }

  return (
    <div
      className="quota-ring glass glass-flat"
      role="img"
      aria-label={`${quota.remaining} of ${quota.limit} picks left`}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        {cells.map(({ i, ...dashes }) => (
          <circle key={i} className="quota-cell quota-cell--track" {...circle} {...dashes} />
        ))}
        <g className="quota-glow">
          {cells.map(({ i, ...dashes }) => (
            <circle
              key={i}
              className="quota-cell quota-cell--fill"
              data-filled={i < quota.remaining || undefined}
              data-burn={i === spent || undefined}
              {...circle}
              {...dashes}
            />
          ))}
        </g>
      </svg>
      <Odometer value={quota.remaining} />
    </div>
  )
}

/** A number that rolls: the old value leaves up, the new one arrives from below. */
function Odometer({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const [leaving, setLeaving] = useState<number | null>(null)

  if (shown !== value) {
    setLeaving(shown)
    setShown(value)
  }
  useEffect(() => {
    if (leaving === null) return
    const t = window.setTimeout(() => setLeaving(null), 240)
    return () => window.clearTimeout(t)
  }, [leaving])

  return (
    <span className="odo font-display text-[1.375rem] font-extrabold leading-none tabular-nums" aria-hidden>
      {leaving !== null && (
        <span key={`out-${leaving}-${value}`} className="odo-out">
          {leaving}
        </span>
      )}
      <span key={`in-${value}`} className="odo-in">
        {value}
      </span>
    </span>
  )
}

'use client'

import type { AppMode, SwipeQuota } from '@/lib/types'
import { useFitStretch } from '@/components/useFitStretch'
import { fitStretch } from '@/lib/utils'
import { QuotaMeter } from './QuotaMeter'
import { formatClock, useCountdown } from './useCountdown'

/** Title characters that fit beside the quota ring at normal width (first-paint guess; useFitStretch measures). */
const TITLE_CHARS = 18

export function DeckHeader({
  mode,
  quota,
  onWindowElapsed,
}: {
  mode: AppMode
  quota: SwipeQuota
  onWindowElapsed: () => void
}) {
  const ms = useCountdown(quota.resetsAt, onWindowElapsed)
  const hours = Math.round(quota.windowSeconds / 3600)
  const title = mode === 'dating' ? 'Match' : 'Training Partners'
  const titleRef = useFitStretch<HTMLHeadingElement>(title)

  return (
    <header className="flex items-center justify-between gap-(--space-panel-gap)">
      <div className="min-w-0 flex-1">
        <p className="hud-label text-primary">// Daily selection</p>
        <h1
          ref={titleRef}
          className="overflow-hidden whitespace-nowrap font-display text-title font-extrabold uppercase title-glow"
          style={{ fontStretch: fitStretch(title, TITLE_CHARS) }}
        >
          {title}
        </h1>
        <p className="hud-label mt-1 tabular-nums" aria-live="off">
          {quota.resetsAt ? (
            <>
              <span className="sr-only">Refills in </span>
              {ms === null ? ' ' : formatClock(ms)}
              <span aria-hidden> · refill</span>
            </>
          ) : (
            `${quota.limit} picks / ${hours}h`
          )}
        </p>
      </div>
      <QuotaMeter quota={quota} />
    </header>
  )
}

'use client'

import type { AppMode, SwipeQuota } from '@/lib/types'
import { QuotaMeter } from './QuotaMeter'
import { formatClock, useCountdown } from './useCountdown'

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

  return (
    <header className="flex items-start justify-between gap-(--space-panel-gap)">
      <div className="min-w-0">
        <p className="hud-label text-primary">// Daily selection</p>
        <h1 className="font-display text-title font-bold uppercase [text-shadow:0_0_16px_rgb(34_230_255/0.4)]">
          {mode === 'dating' ? 'Match' : 'Gym Buddies'}
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

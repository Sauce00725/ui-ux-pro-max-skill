'use client'

import type { AppMode, SwipeQuota } from '@/lib/types'
import { QuotaMeter } from './QuotaMeter'
import { formatRemaining, useCountdown } from './useCountdown'

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
        <p className="text-eyebrow font-semibold uppercase text-primary">Daily selection</p>
        <h1 className="font-display text-title font-bold uppercase">{mode === 'dating' ? 'Match' : 'Gym Buddies'}</h1>
        <p className="mt-0.5 text-sm text-muted-fg" aria-live="off">
          {quota.resetsAt
            ? ms === null
              ? ' '
              : `Refills in ${formatRemaining(ms)}`
            : `${quota.limit} picks every ${hours} hours`}
        </p>
      </div>
      <QuotaMeter quota={quota} />
    </header>
  )
}

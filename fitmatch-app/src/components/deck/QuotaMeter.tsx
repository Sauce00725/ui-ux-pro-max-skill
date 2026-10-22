'use client'

import type { SwipeQuota } from '@/lib/types'

/** Pill of pips: one per swipe in this selection, emptying right to left. */
export function QuotaMeter({ quota }: { quota: SwipeQuota }) {
  return (
    <div
      className="glass flex items-center gap-3 rounded-full py-2 pl-3.5 pr-4"
      role="img"
      aria-label={`${quota.remaining} of ${quota.limit} picks left`}
    >
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: quota.limit }, (_, i) => (
          <span key={i} className="quota-pip" data-filled={i < quota.remaining || undefined} />
        ))}
      </div>
      <span className="text-sm font-semibold tabular-nums" aria-hidden>
        {quota.remaining}
        <span className="font-normal text-muted-fg">/{quota.limit}</span>
      </span>
    </div>
  )
}

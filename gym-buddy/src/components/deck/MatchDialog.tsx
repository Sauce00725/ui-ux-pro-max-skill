'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import type { AppMode, DiscoveryCard } from '@/lib/types'
import { GOAL_LABELS } from '@/lib/validation'

/**
 * The match moment, played once: the dialog springs in, the logo's two
 * figures slide together and the bar locks between them, and the title's
 * letters slide together. All of it is skipped under reduced motion.
 */
export function MatchDialog({
  mode,
  card,
  matchId,
  onClose,
}: {
  mode: AppMode
  card: DiscoveryCard
  matchId: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  // Fixed line breaks, sized to the dialog (cqi): the title animates its width, so it must never re-wrap mid-animation.
  const title = mode === 'dating' ? ['It’s a match'] : ['New training', 'partner']

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="match-title"
      className="match-dialog glass-strong rim-light isolate @container m-auto w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-card p-8 text-center text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      style={{ '--like-strength': 1 } as React.CSSProperties}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="deck-orb deck-orb--ember" />
      </div>

      <div className="relative mx-auto w-fit">
        {card.photos[0] && (
          <div className="rounded-full bg-[conic-gradient(from_210deg,var(--rim-stops))] p-[3px] shadow-[0_0_40px_-6px_var(--glow-color)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.photos[0]} alt="" className="size-28 rounded-full border-4 border-bg object-cover" />
          </div>
        )}
        <span className="glass-strong absolute -bottom-4 left-1/2 grid size-12 -translate-x-1/2 place-items-center rounded-full">
          <LogoMark linking className="size-8" />
        </span>
      </div>

      <p className="hud-label mt-8 text-primary">{mode === 'dating' ? '// Signal returned' : '// Link established'}</p>
      <h2 id="match-title" className="match-title mt-1 font-display text-[min(3rem,15cqi)] font-black uppercase leading-[0.9] font-stretch-72%">
        {title.map((line) => (
          <span key={line} className="block whitespace-nowrap">{line}</span>
        ))}
      </h2>
      <p className="mt-3 text-muted-fg">
        You and {card.name} {mode === 'dating' ? 'liked each other.' : 'both want to train together.'}
        {card.sharedGoals[0]
          ? ` You’re both working to ${GOAL_LABELS[card.sharedGoals[0] as keyof typeof GOAL_LABELS]?.toLowerCase() ?? 'reach your goals'}.`
          : card.sharedActivities[0] && ` You both do ${card.sharedActivities[0].toLowerCase()}.`}
      </p>
      <div className="mt-7 flex flex-col gap-3">
        <Link href={`/matches/${matchId}`} className="btn-primary inline-flex h-12 items-center justify-center rounded-full font-semibold">
          Send a message
        </Link>
        <Button variant="ghost" onClick={() => ref.current?.close()}>Keep looking</Button>
      </div>
    </dialog>
  )
}

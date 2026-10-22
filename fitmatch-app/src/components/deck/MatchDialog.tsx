'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import type { AppMode, DiscoveryCard } from '@/lib/types'

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

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="match-title"
      className="glass-strong isolate m-auto w-[calc(100%-2rem)] max-w-sm overflow-hidden rounded-card p-8 text-center text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      style={{ '--like-strength': 1 } as React.CSSProperties}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="deck-orb deck-orb--ember animate-drift" />
      </div>
      {card.photos[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.photos[0]} alt="" className="mx-auto size-28 rounded-full object-cover ring-2 ring-primary ring-offset-4 ring-offset-transparent" />
      )}
      <p className="mt-6 text-eyebrow font-semibold uppercase text-primary">{mode === 'dating' ? 'Mutual like' : 'Mutual'}</p>
      <h2 id="match-title" className="font-display text-display font-bold uppercase">
        {mode === 'dating' ? 'It’s a match' : 'New gym buddy'}
      </h2>
      <p className="mt-2 text-muted-fg">
        You and {card.name} {mode === 'dating' ? 'liked each other.' : 'both want to train together.'}
        {card.sharedActivities[0] && ` You both do ${card.sharedActivities[0].toLowerCase()}.`}
      </p>
      <div className="mt-7 flex flex-col gap-3">
        <Link href={`/matches/${matchId}`} className="inline-flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover">
          Send a message
        </Link>
        <Button variant="ghost" onClick={() => ref.current?.close()}>Keep looking</Button>
      </div>
    </dialog>
  )
}

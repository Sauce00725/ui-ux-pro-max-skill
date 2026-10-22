'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { BadgeCheck, Clock, Dumbbell, Handshake, Heart, MapPin, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FITNESS_LEVELS, TRAINING_TIME_LABELS } from '@/lib/validation'
import type { AppMode, DiscoveryCard } from '@/lib/types'
import { cn } from '@/lib/utils'
import { loadMore, swipe } from './actions'

const REFILL_AT = 3
const EXIT_MS = 220

export function SwipeDeck({ mode, initialCards }: { mode: AppMode; initialCards: DiscoveryCard[] }) {
  const [cards, setCards] = useState(initialCards)
  const [exiting, setExiting] = useState<'like' | 'pass' | null>(null)
  const [match, setMatch] = useState<{ card: DiscoveryCard; matchId: string } | null>(null)
  const [error, setError] = useState<string>()
  const [refilling, startRefill] = useTransition()
  const [exhausted, setExhausted] = useState(initialCards.length === 0)
  const seen = useRef(new Set(initialCards.map((c) => c.id)))

  const top = cards[0]
  const LikeIcon = mode === 'dating' ? Heart : Handshake

  const refill = useCallback(() => {
    startRefill(async () => {
      const more = await loadMore(mode)
      const fresh = more.filter((c) => !seen.current.has(c.id))
      fresh.forEach((c) => seen.current.add(c.id))
      if (fresh.length === 0) setExhausted(true)
      setCards((prev) => [...prev, ...fresh])
    })
  }, [mode])

  const decide = useCallback(
    (action: 'like' | 'pass') => {
      if (!top || exiting) return
      setError(undefined)
      setExiting(action)

      // Optimistic: animate the card out immediately, then reconcile.
      window.setTimeout(() => {
        setCards((prev) => prev.filter((c) => c.id !== top.id))
        setExiting(null)
      }, EXIT_MS)

      swipe({ targetId: top.id, mode, action }).then((res) => {
        if (!res.ok) {
          setError(res.message)
          // Put it back once the exit animation has finished removing it.
          window.setTimeout(() => setCards((prev) => [top, ...prev.filter((c) => c.id !== top.id)]), EXIT_MS + 30)
          return
        }
        if (res.data?.matchId) setMatch({ card: top, matchId: res.data.matchId })
      })

      if (cards.length - 1 <= REFILL_AT && !exhausted && !refilling) refill()
    },
    [top, exiting, mode, cards.length, exhausted, refilling, refill],
  )

  // Keyboard: ← pass, → like
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (match || (e.target as HTMLElement).closest('input, textarea')) return
      if (e.key === 'ArrowLeft') decide('pass')
      if (e.key === 'ArrowRight') decide('like')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decide, match])

  return (
    <div className="mx-auto flex h-[calc(100dvh-5rem)] max-w-md flex-col px-4 pb-4 pt-3">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold uppercase">{mode === 'dating' ? 'Match' : 'Gym Buddies'}</h1>
        {mode === 'buddy' && (
          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">Friends only</span>
        )}
      </header>

      <div className="relative flex-1">
        {top ? (
          <ProfileCard key={top.id} card={top} exiting={exiting} />
        ) : (
          <EmptyState mode={mode} loading={refilling} onRetry={() => { setExhausted(false); refill() }} />
        )}
      </div>

      {error && <p role="alert" className="mt-2 text-center text-sm text-danger">{error}</p>}

      {top && (
        <div className="mt-4 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => decide('pass')}
            aria-label={`Pass on ${top.name}`}
            className="grid size-16 place-items-center rounded-full border-2 bg-surface text-muted-fg transition-all duration-200 hover:scale-105 hover:border-danger hover:text-danger"
          >
            <X className="size-7" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => decide('like')}
            aria-label={mode === 'dating' ? `Like ${top.name}` : `Connect with ${top.name}`}
            className="grid size-20 place-items-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30 transition-all duration-200 hover:scale-105 hover:bg-primary-hover"
          >
            <LikeIcon className="size-9" aria-hidden />
          </button>
        </div>
      )}

      {match && <MatchDialog mode={mode} {...match} onClose={() => setMatch(null)} />}
    </div>
  )
}

function ProfileCard({ card, exiting }: { card: DiscoveryCard; exiting: 'like' | 'pass' | null }) {
  const [photo, setPhoto] = useState(0)
  const level = card.fitnessLevel ? FITNESS_LEVELS[card.fitnessLevel - 1] : null

  return (
    <article
      aria-label={`${card.name}, ${card.age}`}
      className={cn(
        'absolute inset-0 overflow-y-auto rounded-3xl bg-card shadow-2xl transition-all duration-200 ease-out',
        exiting === 'like' && 'translate-x-[120%] rotate-12 opacity-0',
        exiting === 'pass' && '-translate-x-[120%] -rotate-12 opacity-0',
      )}
    >
      {/* Photo with tap zones */}
      <div className="relative aspect-[4/5] w-full bg-muted">
        {card.photos[photo] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.photos[photo]} alt="" className="size-full object-cover" />
        )}
        {card.photos.length > 1 && (
          <>
            <div className="absolute inset-x-3 top-3 flex gap-1.5" aria-hidden>
              {card.photos.map((_, i) => (
                <span key={i} className={cn('h-1 flex-1 rounded-full', i === photo ? 'bg-white' : 'bg-white/40')} />
              ))}
            </div>
            <button type="button" aria-label="Previous photo" className="absolute inset-y-0 left-0 w-1/3"
              onClick={() => setPhoto((p) => Math.max(0, p - 1))} />
            <button type="button" aria-label="Next photo" className="absolute inset-y-0 right-0 w-1/3"
              onClick={() => setPhoto((p) => Math.min(card.photos.length - 1, p + 1))} />
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-16">
          <h2 className="flex items-center gap-2 font-display text-4xl font-bold leading-none text-white">
            {card.name}, {card.age}
            {card.isVerified && <BadgeCheck className="size-6 text-accent" aria-label="Verified" />}
          </h2>
          <p className="mt-1.5 flex items-center gap-1 text-sm text-white/85">
            <MapPin className="size-4" aria-hidden />
            {card.distanceMi} mi away{card.city ? ` · ${card.city}` : ''}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-5 p-5">
        {card.headline && <p className="font-display text-xl font-semibold uppercase text-primary">“{card.headline}”</p>}

        {(card.sharedActivities.length > 0 || card.otherActivities.length > 0) && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-fg">Activities</h3>
            <ul className="flex flex-wrap gap-2">
              {card.sharedActivities.map((a) => (
                <li key={a} className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-on-primary">
                  {a} <span className="sr-only">(shared)</span>
                </li>
              ))}
              {card.otherActivities.map((a) => (
                <li key={a} className="rounded-full border px-3 py-1 text-sm">{a}</li>
              ))}
            </ul>
            {card.sharedActivities.length > 0 && (
              <p className="mt-2 text-xs text-muted-fg">Highlighted = you both do it</p>
            )}
          </section>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-fg">
          {level && (
            <span className="flex items-center gap-1.5"><Dumbbell className="size-4" aria-hidden />{level}</span>
          )}
          {card.trainingTimes.length > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {card.trainingTimes.map((t) => TRAINING_TIME_LABELS[t as keyof typeof TRAINING_TIME_LABELS] ?? t).join(', ')}
            </span>
          )}
        </div>

        {card.bio && <p className="whitespace-pre-line leading-relaxed">{card.bio}</p>}
      </div>
    </article>
  )
}

function EmptyState({ mode, loading, onRetry }: { mode: AppMode; loading: boolean; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center">
      <h2 className="font-display text-2xl font-bold uppercase">{loading ? 'Finding people…' : 'You’re all caught up'}</h2>
      {!loading && (
        <>
          <p className="mt-2 max-w-xs text-muted-fg">
            No new {mode === 'dating' ? 'people' : 'buddies'} nearby right now. Widen your distance, or check out local
            events and meet people in person.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={onRetry}><RefreshCw className="size-4" aria-hidden />Refresh</Button>
            <Link href="/events" className="inline-flex h-12 items-center rounded-xl bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover">
              Browse events
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

function MatchDialog({
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
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-surface p-8 text-center text-fg backdrop:bg-black/80"
    >
      {card.photos[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.photos[0]} alt="" className="mx-auto size-28 rounded-full object-cover ring-4 ring-primary" />
      )}
      <h2 id="match-title" className="mt-5 font-display text-4xl font-bold uppercase text-primary">
        {mode === 'dating' ? 'It’s a match!' : 'New gym buddy!'}
      </h2>
      <p className="mt-2 text-muted-fg">
        You and {card.name} {mode === 'dating' ? 'liked each other.' : 'both want to train together.'}
        {card.sharedActivities[0] && ` You both do ${card.sharedActivities[0].toLowerCase()}.`}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link href={`/matches/${matchId}`} className="inline-flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-on-primary hover:bg-primary-hover">
          Send a message
        </Link>
        <Button variant="ghost" onClick={() => ref.current?.close()}>Keep swiping</Button>
      </div>
    </dialog>
  )
}

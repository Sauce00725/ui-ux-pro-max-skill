'use client'

import { useEffect, useRef, useState } from 'react'
import type { AppMode, DiscoveryCard, LikeExtras, LikeTarget, SuperQuota, SwipeQuota } from '@/lib/types'
import { CardStack } from './CardStack'
import { DeckEmptyState } from './DeckEmptyState'
import { DeckHeader } from './DeckHeader'
import { DeckStage } from './DeckStage'
import { LikeComposer } from './LikeComposer'
import { MatchDialog } from './MatchDialog'
import { SwipeControls } from './SwipeControls'
import { useDailyDeck, type DeckApi } from './useDailyDeck'
import { useSwipeGesture } from './useSwipeGesture'

/**
 * Composition root. Wires the two state layers together and owns nothing else:
 *
 *   useDailyDeck     domain: cards, quotas, match → `view` (what to show)
 *   useSwipeGesture  visual: pointer physics → CSS variables (how it moves)
 *
 * They meet at exactly two callbacks: onCommit (release) and onExited (landed).
 * A like sent from the composer (photo/prompt + comment) takes the same path:
 * its extras are parked in a ref, then the card is flung like any other swipe.
 */
export function DailyDeck({
  mode,
  initialCards,
  initialQuota,
  initialSuperQuota,
  api,
}: {
  mode: AppMode
  initialCards: DiscoveryCard[]
  initialQuota: SwipeQuota
  initialSuperQuota: SuperQuota
  api?: DeckApi
}) {
  const deck = useDailyDeck({ mode, initialCards, initialQuota, initialSuperQuota, api })
  const { view, state } = deck
  const stageRef = useRef<HTMLDivElement>(null)
  const pendingExtras = useRef<LikeExtras>({})
  const [composer, setComposer] = useState<{ card: DiscoveryCard; target: LikeTarget } | null>(null)

  const top = view.kind === 'deck' ? view.stack[0] : null
  const canSwipe = view.kind === 'deck' && view.canSwipe && !state.match && !composer
  const canSuper = canSwipe && view.kind === 'deck' && view.canSuper

  const gesture = useSwipeGesture({
    stageRef,
    cardKey: top?.id ?? null,
    enabled: canSwipe,
    canSuper,
    onCommit: (direction) => {
      const extras = pendingExtras.current
      pendingExtras.current = {}
      if (top) deck.commit(top, direction, extras)
    },
    onExited: () => top && deck.exit(top.id),
  })

  // ← pass, ↑ Super Like, → like. Same code path as a hand throw.
  const { fling } = gesture
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canSwipe || (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowLeft') fling('pass')
      if (e.key === 'ArrowRight') fling('like')
      if (e.key === 'ArrowUp' && canSuper) {
        e.preventDefault()
        fling('super')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canSwipe, canSuper, fling])

  return (
    <DeckStage
      ref={stageRef}
      style={gesture.stageStyle}
      className="mx-auto flex h-[calc(100dvh-5rem-3.5rem-env(safe-area-inset-top))] max-w-md flex-col px-(--space-gutter) pb-(--space-gutter) pt-3"
    >
      <DeckHeader mode={mode} quota={state.quota} onWindowElapsed={deck.refresh} />

      <div className="relative mt-(--space-gutter) min-h-0 flex-1">
        {view.kind === 'deck' ? (
          <CardStack
            stack={view.stack}
            mode={mode}
            gesture={gesture}
            onLikeItem={(card, target) => setComposer({ card, target })}
          />
        ) : (
          <DeckEmptyState view={view} mode={mode} onRefresh={deck.refresh} />
        )}
      </div>

      {state.error && (
        <p role="alert" className="mt-2 text-center text-sm text-danger">{state.error}</p>
      )}

      {view.kind === 'deck' && (
        <div className="mt-(--space-gutter)">
          <SwipeControls
            mode={mode}
            name={top?.name}
            // Not disabled mid-animation (fling() already ignores input then), so
            // the buttons don't flicker dim on every swipe; only when picks run out.
            disabled={state.quota.remaining === 0}
            superLeft={state.superQuota.remaining}
            onPass={() => fling('pass')}
            onSuper={() => fling('super')}
            onLike={() => fling('like')}
          />
        </div>
      )}

      <p className="sr-only" aria-live="polite">{state.announcement}</p>

      {composer && (
        <LikeComposer
          mode={mode}
          card={composer.card}
          target={composer.target}
          superQuota={state.superQuota}
          onClose={() => setComposer(null)}
          onSend={({ comment, super: asSuper }) => {
            pendingExtras.current = {
              comment: comment || undefined,
              ...(composer.target.kind === 'photo' ? { photoId: composer.target.id } : { promptId: composer.target.id }),
            }
            setComposer(null)
            // Fling on the next frame, once the composer no longer blocks input.
            requestAnimationFrame(() => fling(asSuper ? 'super' : 'like'))
          }}
        />
      )}

      {state.match && <MatchDialog mode={mode} {...state.match} onClose={deck.dismissMatch} />}
    </DeckStage>
  )
}

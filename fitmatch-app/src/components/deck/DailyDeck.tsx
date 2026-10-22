'use client'

import { useEffect, useRef } from 'react'
import type { AppMode, DiscoveryCard, SwipeQuota } from '@/lib/types'
import { CardStack } from './CardStack'
import { DeckEmptyState } from './DeckEmptyState'
import { DeckHeader } from './DeckHeader'
import { DeckStage } from './DeckStage'
import { MatchDialog } from './MatchDialog'
import { SwipeControls } from './SwipeControls'
import { useDailyDeck, type DeckApi } from './useDailyDeck'
import { useSwipeGesture } from './useSwipeGesture'

/**
 * Composition root. Wires the two state layers together and owns nothing else:
 *
 *   useDailyDeck     domain: cards, quota, match → `view` (what to show)
 *   useSwipeGesture  visual: pointer physics → CSS variables (how it moves)
 *
 * They meet at exactly two callbacks: onCommit (release) and onExited (landed).
 */
export function DailyDeck({
  mode,
  initialCards,
  initialQuota,
  api,
}: {
  mode: AppMode
  initialCards: DiscoveryCard[]
  initialQuota: SwipeQuota
  api?: DeckApi
}) {
  const deck = useDailyDeck({ mode, initialCards, initialQuota, api })
  const { view, state } = deck
  const stageRef = useRef<HTMLDivElement>(null)

  const top = view.kind === 'deck' ? view.stack[0] : null
  const canSwipe = view.kind === 'deck' && view.canSwipe && !state.match

  const gesture = useSwipeGesture({
    stageRef,
    cardKey: top?.id ?? null,
    enabled: canSwipe,
    onCommit: (direction) => top && deck.commit(top, direction),
    onExited: () => top && deck.exit(top.id),
  })

  // ← pass, → like. Same code path as a hand throw.
  const { fling } = gesture
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canSwipe || (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowLeft') fling('pass')
      if (e.key === 'ArrowRight') fling('like')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canSwipe, fling])

  return (
    <DeckStage
      ref={stageRef}
      style={gesture.stageStyle}
      className="mx-auto flex h-[calc(100dvh-5rem)] max-w-md flex-col px-(--space-gutter) pb-(--space-gutter) pt-3"
    >
      <DeckHeader mode={mode} quota={state.quota} onWindowElapsed={deck.refresh} />

      <div className="relative mt-(--space-gutter) min-h-0 flex-1">
        {view.kind === 'deck' ? (
          <CardStack stack={view.stack} mode={mode} gesture={gesture} />
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
            onPass={() => fling('pass')}
            onLike={() => fling('like')}
          />
        </div>
      )}

      <p className="sr-only" aria-live="polite">{state.announcement}</p>

      {state.match && <MatchDialog mode={mode} {...state.match} onClose={deck.dismissMatch} />}
    </DeckStage>
  )
}

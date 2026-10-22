'use client'

import { useCallback, useMemo, useReducer, useRef } from 'react'
import { refreshSelection, swipe } from '@/app/(app)/discover/actions'
import type { AppMode, DiscoveryCard, LikeExtras, Selection, SuperQuota, SwipeQuota, SwipeResult } from '@/lib/types'
import { deckReducer, initDeck, selectDeckView, type DeckAction, type SwipeDirection } from './deckState'

type RejectAction = Extract<DeckAction, { type: 'rejected' }>

export interface DeckApi {
  swipe: (
    input: { targetId: string; mode: AppMode; action: 'like' | 'pass'; super?: boolean } & LikeExtras,
  ) => Promise<SwipeResult>
  refreshSelection: (mode: AppMode) => Promise<Selection>
}

const serverApi: DeckApi = { swipe, refreshSelection }

/**
 * Connects the pure deck reducer to the server. Knows nothing about
 * gestures or pixels; it only hears "this card was committed" and "this card
 * finished leaving".
 */
export function useDailyDeck({
  mode,
  initialCards,
  initialQuota,
  initialSuperQuota,
  api = serverApi,
}: {
  mode: AppMode
  initialCards: DiscoveryCard[]
  initialQuota: SwipeQuota
  initialSuperQuota: SuperQuota
  api?: DeckApi
}) {
  const [state, dispatch] = useReducer(deckReducer, undefined, () =>
    initDeck(initialCards, initialQuota, initialSuperQuota),
  )
  const view = useMemo(() => selectDeckView(state), [state])

  // A rejection can come back while the card is still flying; hold it until it lands.
  const exited = useRef(new Set<string>())
  const heldRejections = useRef(new Map<string, RejectAction>())

  const reject = useCallback((action: RejectAction) => {
    if (exited.current.has(action.card.id)) {
      exited.current.delete(action.card.id)
      dispatch(action)
    } else {
      heldRejections.current.set(action.card.id, action)
    }
  }, [])

  const commit = useCallback(
    (card: DiscoveryCard, direction: SwipeDirection, extras: LikeExtras = {}) => {
      dispatch({ type: 'commit', card, direction })
      api
        .swipe({
          targetId: card.id,
          mode,
          action: direction === 'pass' ? 'pass' : 'like',
          super: direction === 'super',
          ...(direction === 'pass' ? {} : extras),
        })
        .then((res) => {
          if (res.ok) {
            exited.current.delete(card.id)
            dispatch({
              type: 'confirmed',
              quota: res.quota,
              superQuota: res.superQuota,
              match: res.matchId ? { card, matchId: res.matchId } : null,
            })
          } else {
            reject({ type: 'rejected', card, direction, message: res.message, quota: res.quota, superQuota: res.superQuota })
          }
        })
        .catch(() => reject({ type: 'rejected', card, direction, message: 'Connection lost. Try again.' }))
    },
    [api, mode, reject],
  )

  const exit = useCallback((id: string) => {
    dispatch({ type: 'exited', id })
    const held = heldRejections.current.get(id)
    if (held) {
      heldRejections.current.delete(id)
      dispatch(held)
    } else {
      exited.current.add(id)
    }
  }, [])

  const refresh = useCallback(() => {
    dispatch({ type: 'refresh-start' })
    api
      .refreshSelection(mode)
      .then(({ cards, quota, superQuota }) => dispatch({ type: 'refresh-done', cards, quota, superQuota }))
      .catch(() => dispatch({ type: 'refresh-failed', message: 'Couldn’t load your selection.' }))
  }, [api, mode])

  const dismissMatch = useCallback(() => dispatch({ type: 'dismiss-match' }), [])

  return { state, view, commit, exit, refresh, dismissMatch }
}

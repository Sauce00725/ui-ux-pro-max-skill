import type { DiscoveryCard, SuperQuota, SwipeQuota } from '@/lib/types'

/*
 * DOMAIN STATE: what the deck *is*, not how it looks.
 *
 * Pure data + a reducer. No DOM, no animation values, no timers. Whether the
 * user sees a card stack, a "come back later" panel or a spinner is derived
 * from this state by `selectDeckView`, a single function the UI switches on.
 *
 * Visual/physics state (drag offset, rotation, glow strength) never enters
 * here: it lives in useSwipeGesture as CSS variables on the DOM.
 */

/** right = like, left = pass, up = Super Like ("really interested"). */
export type SwipeDirection = 'like' | 'pass' | 'super'

export interface DeckState {
  cards: DiscoveryCard[] // top of the deck first
  quota: SwipeQuota
  superQuota: SuperQuota
  exitingId: string | null // flung, animating out, still in `cards`
  refreshing: boolean
  error: string | null
  match: { card: DiscoveryCard; matchId: string } | null
  announcement: string // screen-reader live region text
}

export type DeckAction =
  | { type: 'commit'; card: DiscoveryCard; direction: SwipeDirection }
  | { type: 'exited'; id: string }
  | { type: 'confirmed'; quota: SwipeQuota; superQuota: SuperQuota; match: DeckState['match'] }
  | {
      type: 'rejected'
      card: DiscoveryCard
      direction: SwipeDirection
      message: string
      quota?: SwipeQuota
      superQuota?: SuperQuota
    }
  | { type: 'refresh-start' }
  | { type: 'refresh-done'; cards: DiscoveryCard[]; quota: SwipeQuota; superQuota: SuperQuota }
  | { type: 'refresh-failed'; message: string }
  | { type: 'dismiss-match' }

const SUPER_WINDOW_MS = 24 * 60 * 60 * 1000

export function initDeck(cards: DiscoveryCard[], quota: SwipeQuota, superQuota: SuperQuota): DeckState {
  return { cards, quota, superQuota, exitingId: null, refreshing: false, error: null, match: null, announcement: '' }
}

const left = (n: number) => (n === 0 ? 'No picks left for now.' : `${n} left in this selection.`)
const verb = { like: 'Liked', pass: 'Passed on', super: 'Super liked' } as const

export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case 'commit': {
      // Optimistic: spend one swipe (and the Super Like) now; the server confirms or rejects.
      const remaining = Math.max(0, state.quota.remaining - 1)
      const resetsAt =
        state.quota.resetsAt ?? new Date(Date.now() + state.quota.windowSeconds * 1000).toISOString()
      const superQuota =
        action.direction === 'super'
          ? { remaining: 0, resetsAt: new Date(Date.now() + SUPER_WINDOW_MS).toISOString() }
          : state.superQuota
      return {
        ...state,
        exitingId: action.card.id,
        error: null,
        quota: { ...state.quota, remaining, resetsAt },
        superQuota,
        announcement: `${verb[action.direction]} ${action.card.name}. ${left(remaining)}`,
      }
    }

    case 'exited':
      return {
        ...state,
        cards: state.cards.filter((c) => c.id !== action.id),
        exitingId: state.exitingId === action.id ? null : state.exitingId,
      }

    case 'confirmed':
      // Server is the source of truth (other tabs/devices count, replies to likes are free).
      return {
        ...state,
        quota: action.quota,
        superQuota: action.superQuota,
        match: action.match ?? state.match,
        announcement: action.match ? `It’s a match with ${action.match.card.name}!` : state.announcement,
      }

    case 'rejected': {
      // Put the card back on top and restore what the optimistic commit spent.
      const quota = action.quota ?? { ...state.quota, remaining: state.quota.remaining + 1 }
      const superQuota =
        action.superQuota ?? (action.direction === 'super' ? { remaining: 1, resetsAt: null } : state.superQuota)
      return {
        ...state,
        cards: [action.card, ...state.cards.filter((c) => c.id !== action.card.id)],
        quota,
        superQuota,
        error: action.message,
        announcement: action.message,
      }
    }

    case 'refresh-start':
      return { ...state, refreshing: true, error: null }

    case 'refresh-done':
      return {
        ...state,
        refreshing: false,
        cards: action.cards,
        quota: action.quota,
        superQuota: action.superQuota,
        announcement: action.cards.length ? `New selection: ${action.cards.length} people.` : state.announcement,
      }

    case 'refresh-failed':
      return { ...state, refreshing: false, error: action.message }

    case 'dismiss-match':
      return { ...state, match: null }
  }
}

/* ─── View selection: the ONE place layout state is decided ───────────────── */

export type DeckView =
  | { kind: 'deck'; stack: DiscoveryCard[]; canSwipe: boolean; canSuper: boolean }
  | { kind: 'loading' }
  | { kind: 'quota-exhausted'; resetsAt: string | null; windowSeconds: number }
  | { kind: 'pool-exhausted' }

export const VISIBLE_STACK = 3

export function selectDeckView(state: DeckState): DeckView {
  const animating = state.exitingId !== null

  // Let a flung card finish its exit before swapping in an empty state.
  if (state.cards.length > 0 && (state.quota.remaining > 0 || animating)) {
    const canSwipe = !animating && state.quota.remaining > 0
    return {
      kind: 'deck',
      stack: state.cards.slice(0, VISIBLE_STACK),
      canSwipe,
      canSuper: canSwipe && state.superQuota.remaining > 0,
    }
  }
  if (state.refreshing) return { kind: 'loading' }
  if (state.quota.remaining === 0) {
    return { kind: 'quota-exhausted', resetsAt: state.quota.resetsAt, windowSeconds: state.quota.windowSeconds }
  }
  return { kind: 'pool-exhausted' }
}

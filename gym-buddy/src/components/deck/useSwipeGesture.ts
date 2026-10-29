'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { SwipeDirection } from './deckState'

/*
 * VISUAL STATE: how the top card is being handled, frame by frame.
 *
 * Nothing here goes through React state. Pointer movement is written straight
 * to CSS custom properties (rAF-throttled) so a drag never re-renders a
 * component:
 *
 *   on the card   --drag-x, --drag-y, --drag-rot, --drag-origin
 *   on the stage  --swipe-amount, --like-strength, --pass-strength, --super-strength
 *
 * One more mark goes on the stage when a swipe commits: `data-fire="like|pass|super"`
 * for about a second, which is what the one-shot aftermath keys off (the control
 * you used answers back, the tag lands, a ring leaves the deck; see motion.css).
 *
 * The stage variables are inherited by everything inside it, so stacked cards,
 * stamps, ambient glows and control buttons all react to the same gesture with
 * zero extra wiring (see styles/components.css).
 *
 * Right = like, left = pass, up = Super Like. Whichever axis dominates wins.
 */

export const MOTION = {
  flingMs: 380, // thrown by hand: it already has your momentum, so it leaves fast
  tossMs: 560, // sent by a button or key: a longer arc, so the throw and its effects can be seen
  snapMs: 720,
  maxRotationDeg: 16,
  commitRatio: 0.32, // of card width (like/pass)
  superRatio: 0.22, // of card height (Super Like)
  flickVelocity: 0.5, // px/ms
  slopPx: 6, // movement before a press becomes a drag (taps stay clicks)
  verticalDamping: 0.35, // during a sideways drag
  upFollow: 0.75, // during an upward (Super Like) drag
  blockedUpDamping: 0.12, // upward drag with no Super Like left: rubber-band
} as const

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

interface Options {
  stageRef: RefObject<HTMLElement | null>
  /** Identity of the current top card. Changing it resets all visual state. */
  cardKey: string | null
  enabled: boolean
  /** Whether swiping up can commit a Super Like right now. */
  canSuper: boolean
  /** Fired on release/fling: start the data work immediately. */
  onCommit: (direction: SwipeDirection) => void
  /** Fired when the card has fully left the screen. */
  onExited: () => void
}

type Sample = { x: number; y: number; t: number }

export function useSwipeGesture({ stageRef, cardKey, enabled, canSuper, onCommit, onExited }: Options) {
  const cardRef = useRef<HTMLElement | null>(null)
  // Handlers read the latest props through this ref (updated after each render, before paint).
  const callbacks = useRef({ onCommit, onExited, enabled, canSuper })
  useLayoutEffect(() => {
    callbacks.current = { onCommit, onExited, enabled, canSuper }
  })

  const g = useRef({
    pointerId: -1,
    tracking: false,
    dragging: false,
    locked: false, // flinging, ignore input
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    grabSign: 1, // +1 grabbed top half, -1 bottom half (card pivots the other way)
    samples: [] as Sample[],
    frame: 0,
  })
  const reducedMotion = useRef(false)
  const fireTimer = useRef(0)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.current = mq.matches
    const onChange = (e: MediaQueryListEvent) => (reducedMotion.current = e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  /** horizontal: -1 (pass) … +1 (like); up: 0 … 1 (Super Like). */
  const writeStage = useCallback(
    (horizontal: number, up = 0) => {
      const stage = stageRef.current
      if (!stage) return
      stage.style.setProperty('--swipe-amount', String(Math.max(Math.abs(horizontal), up)))
      stage.style.setProperty('--like-strength', String(Math.max(0, horizontal)))
      stage.style.setProperty('--pass-strength', String(Math.max(0, -horizontal)))
      stage.style.setProperty('--super-strength', String(up))
    },
    [stageRef],
  )

  const setCard = (el: HTMLElement, x: number, y: number, rot: number) => {
    el.style.setProperty('--drag-x', x.toFixed(2))
    el.style.setProperty('--drag-y', y.toFixed(2))
    el.style.setProperty('--drag-rot', rot.toFixed(3))
  }

  /** Map raw pointer offset → card transform + stage signals. */
  const write = useCallback(
    (dx: number, dy: number) => {
      const el = cardRef.current
      if (!el) return
      const width = el.offsetWidth || 1
      const height = el.offsetHeight || 1
      const goingUp = -dy > Math.abs(dx)

      if (goingUp) {
        if (!callbacks.current.canSuper) {
          // No Super Like left: resist, so it reads as "not available".
          setCard(el, dx * 0.3, dy * MOTION.blockedUpDamping, 0)
          writeStage(0, 0)
          return
        }
        setCard(el, dx * 0.4, dy * MOTION.upFollow, reducedMotion.current ? 0 : (dx / width) * 4)
        writeStage(0, clamp(-dy / (height * MOTION.superRatio), 0, 1))
        return
      }

      const rot = reducedMotion.current
        ? 0
        : clamp((dx / width) * MOTION.maxRotationDeg * g.current.grabSign, -MOTION.maxRotationDeg, MOTION.maxRotationDeg)
      setCard(el, dx, dy * MOTION.verticalDamping, rot)
      writeStage(clamp(dx / (width * MOTION.commitRatio), -1, 1), 0)
    },
    [writeStage],
  )

  const schedule = useCallback(() => {
    if (g.current.frame) return
    g.current.frame = requestAnimationFrame(() => {
      g.current.frame = 0
      write(g.current.dx, g.current.dy)
    })
  }, [write])

  const setDragging = useCallback(
    (on: boolean) => {
      if (on) stageRef.current?.setAttribute('data-dragging', '')
      else stageRef.current?.removeAttribute('data-dragging')
    },
    [stageRef],
  )

  /** Mark what was just done, so CSS can answer back. Restarts cleanly if the same kind fires twice in a row. */
  const fire = useCallback(
    (direction: SwipeDirection) => {
      const stage = stageRef.current
      if (!stage) return
      stage.removeAttribute('data-fire')
      void stage.offsetWidth // commit the removal, so setting it again replays the animations
      stage.setAttribute('data-fire', direction)
      window.clearTimeout(fireTimer.current)
      fireTimer.current = window.setTimeout(() => stage.removeAttribute('data-fire'), 900)
    },
    [stageRef],
  )
  useEffect(() => () => window.clearTimeout(fireTimer.current), [])

  /** Throw the card off-screen. Used by release, buttons and keyboard alike. */
  const fling = useCallback(
    (direction: SwipeDirection, velocity = 0) => {
      const el = cardRef.current
      const s = g.current
      if (!el || s.locked || !callbacks.current.enabled) return
      if (direction === 'super' && !callbacks.current.canSuper) return
      s.locked = true
      cancelAnimationFrame(s.frame)
      s.frame = 0
      setDragging(false)
      fire(direction)

      // A hand throw keeps your momentum; a button or key toss starts from rest, so it gets
      // a longer, gentler arc. The card carries its own timing; the exit timer follows it.
      const byHand = s.dx !== 0 || s.dy !== 0
      const flightMs = byHand ? MOTION.flingMs : MOTION.tossMs
      el.style.setProperty('--dur-fling', `${flightMs}ms`)
      if (!byHand) el.style.setProperty('--ease-throw', 'cubic-bezier(0.33, 0, 0.2, 1)')

      callbacks.current.onCommit(direction)
      el.setAttribute('data-flinging', '')

      if (direction === 'super') {
        writeStage(0, 1)
        if (reducedMotion.current) {
          el.setAttribute('data-fade', '')
          setCard(el, 0, -40, 0)
        } else {
          const travel = window.innerHeight + el.offsetHeight + Math.abs(velocity) * 120
          setCard(el, s.dx * 0.4, -travel, (s.dx / (el.offsetWidth || 1)) * 6)
        }
      } else {
        const sign = direction === 'like' ? 1 : -1
        writeStage(sign, 0) // stamp fully visible, next card fully risen
        if (reducedMotion.current) {
          el.setAttribute('data-fade', '')
          setCard(el, sign * 40, 0, 0)
        } else {
          const travel = window.innerWidth / 2 + el.offsetWidth * 1.1 + Math.abs(velocity) * 120
          // Thrown by hand: keep the vertical direction of the throw. By button: a slight upward toss.
          const lift = byHand ? s.dy * MOTION.verticalDamping * 2 : -30
          setCard(el, sign * travel, lift, sign * s.grabSign * MOTION.maxRotationDeg * 1.6)
        }
      }

      // A timer rather than transitionend: it fires once, and fires even when a
      // transition is skipped (background tab, reduced motion).
      window.setTimeout(() => callbacks.current.onExited(), flightMs + 20)
    },
    [writeStage, setDragging, fire],
  )

  const snapBack = useCallback(() => {
    g.current.dx = 0
    g.current.dy = 0
    write(0, 0) // the CSS transition (a spring) does the organic settle
  }, [write])

  // New top card → clear everything synchronously, before paint, so the card
  // that just rose to the top inherits a perfectly neutral state.
  useLayoutEffect(() => {
    const s = g.current
    s.locked = false
    s.tracking = s.dragging = false
    s.dx = s.dy = 0
    s.grabSign = 1
    writeStage(0, 0)
    setDragging(false)
  }, [cardKey, writeStage, setDragging])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const s = g.current
    if (!callbacks.current.enabled || s.locked || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return

    const rect = e.currentTarget.getBoundingClientRect()
    s.grabSign = e.clientY - rect.top < rect.height / 2 ? 1 : -1
    // Pivot from the far edge, like holding a real card by one end.
    e.currentTarget.style.setProperty('--drag-origin', s.grabSign > 0 ? '50% 120%' : '50% -20%')

    s.pointerId = e.pointerId
    s.tracking = true
    s.dragging = false
    s.startX = e.clientX
    s.startY = e.clientY
    s.dx = s.dy = 0
    s.samples = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }]
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const s = g.current
      if (!s.tracking || e.pointerId !== s.pointerId) return
      s.dx = e.clientX - s.startX
      s.dy = e.clientY - s.startY

      if (!s.dragging) {
        if (Math.hypot(s.dx, s.dy) < MOTION.slopPx) return
        // Capture only once it's a real drag, so taps still reach child buttons.
        s.dragging = true
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragging(true)
      }

      s.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp })
      if (s.samples.length > 6) s.samples.shift()
      schedule()
    },
    [schedule, setDragging],
  )

  const onPointerEnd = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const s = g.current
      if (!s.tracking || e.pointerId !== s.pointerId) return
      s.tracking = false
      if (!s.dragging) return // it was a tap
      s.dragging = false
      setDragging(false)
      if (e.type === 'pointercancel') return snapBack()

      const first = s.samples[0]
      const last = s.samples[s.samples.length - 1]
      const dt = last.t - first.t
      const vx = dt > 0 ? (last.x - first.x) / dt : 0
      const vy = dt > 0 ? (last.y - first.y) / dt : 0
      const el = cardRef.current
      const width = el?.offsetWidth ?? 1
      const height = el?.offsetHeight ?? 1

      if (-s.dy > Math.abs(s.dx)) {
        const flickedUp = vy < -MOTION.flickVelocity && -s.dy > 30
        if (callbacks.current.canSuper && (-s.dy > height * MOTION.superRatio || flickedUp)) {
          return fling('super', vy)
        }
        return snapBack()
      }

      const flicked = Math.abs(vx) > MOTION.flickVelocity && Math.sign(vx) === Math.sign(s.dx) && Math.abs(s.dx) > 24
      if (Math.abs(s.dx) > width * MOTION.commitRatio || flicked) {
        fling(s.dx > 0 ? 'like' : 'pass', vx)
      } else {
        snapBack()
      }
    },
    [fling, snapBack, setDragging],
  )

  return {
    cardRef,
    fling,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
    /** Shares motion timing with CSS so JS timers and transitions can't drift. */
    stageStyle: {
      '--dur-fling': `${MOTION.flingMs}ms`,
      '--dur-snap': `${MOTION.snapMs}ms`,
    } as React.CSSProperties,
  }
}

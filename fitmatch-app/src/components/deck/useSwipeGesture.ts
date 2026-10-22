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
 *   on the stage  --swipe-amount, --like-strength, --pass-strength
 *
 * The stage variables are inherited by everything inside it, so stacked cards,
 * stamps, ambient glows and control buttons all react to the same gesture with
 * zero extra wiring (see styles/components.css).
 */

export const MOTION = {
  flingMs: 380,
  snapMs: 560,
  maxRotationDeg: 16,
  commitRatio: 0.32, // of card width
  flickVelocity: 0.5, // px/ms
  slopPx: 6, // movement before a press becomes a drag (taps stay clicks)
  verticalDamping: 0.35,
} as const

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

interface Options {
  stageRef: RefObject<HTMLElement | null>
  /** Identity of the current top card. Changing it resets all visual state. */
  cardKey: string | null
  enabled: boolean
  /** Fired on release/fling: start the data work immediately. */
  onCommit: (direction: SwipeDirection) => void
  /** Fired when the card has fully left the screen. */
  onExited: () => void
}

export function useSwipeGesture({ stageRef, cardKey, enabled, onCommit, onExited }: Options) {
  const cardRef = useRef<HTMLElement | null>(null)
  const callbacks = useRef({ onCommit, onExited, enabled })
  callbacks.current = { onCommit, onExited, enabled }

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
    samples: [] as { x: number; t: number }[],
    frame: 0,
  })
  const reducedMotion = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.current = mq.matches
    const onChange = (e: MediaQueryListEvent) => (reducedMotion.current = e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const writeStage = useCallback(
    (progress: number) => {
      const stage = stageRef.current
      if (!stage) return
      stage.style.setProperty('--swipe-amount', String(Math.abs(progress)))
      stage.style.setProperty('--like-strength', String(Math.max(0, progress)))
      stage.style.setProperty('--pass-strength', String(Math.max(0, -progress)))
    },
    [stageRef],
  )

  const write = useCallback(
    (dx: number, dy: number) => {
      const el = cardRef.current
      if (!el) return
      const width = el.offsetWidth || 1
      const rot = reducedMotion.current
        ? 0
        : clamp((dx / width) * MOTION.maxRotationDeg * g.current.grabSign, -MOTION.maxRotationDeg, MOTION.maxRotationDeg)
      el.style.setProperty('--drag-x', dx.toFixed(2))
      el.style.setProperty('--drag-y', dy.toFixed(2))
      el.style.setProperty('--drag-rot', rot.toFixed(3))
      writeStage(clamp(dx / (width * MOTION.commitRatio), -1, 1))
    },
    [writeStage],
  )

  const schedule = useCallback(() => {
    if (g.current.frame) return
    g.current.frame = requestAnimationFrame(() => {
      g.current.frame = 0
      write(g.current.dx, g.current.dy * MOTION.verticalDamping)
    })
  }, [write])

  const setDragging = useCallback(
    (on: boolean) => {
      if (on) stageRef.current?.setAttribute('data-dragging', '')
      else stageRef.current?.removeAttribute('data-dragging')
    },
    [stageRef],
  )

  /** Throw the card off-screen. Used by release, buttons and keyboard alike. */
  const fling = useCallback(
    (direction: SwipeDirection, velocity = 0) => {
      const el = cardRef.current
      if (!el || g.current.locked || !callbacks.current.enabled) return
      g.current.locked = true
      cancelAnimationFrame(g.current.frame)
      g.current.frame = 0
      setDragging(false)

      const sign = direction === 'like' ? 1 : -1
      callbacks.current.onCommit(direction)

      el.setAttribute('data-flinging', '')
      writeStage(sign) // stamp fully visible, next card fully risen

      if (reducedMotion.current) {
        el.setAttribute('data-fade', '')
        write(sign * 40, 0)
      } else {
        const width = el.offsetWidth
        const travel = window.innerWidth / 2 + width * 1.1 + Math.abs(velocity) * 120
        // Thrown by hand: keep the vertical direction of the throw. By button: a slight upward toss.
        const lift = g.current.dx !== 0 ? g.current.dy * MOTION.verticalDamping * 2 : -30
        el.style.setProperty('--drag-x', String(sign * travel))
        el.style.setProperty('--drag-y', String(lift))
        el.style.setProperty('--drag-rot', String(sign * g.current.grabSign * MOTION.maxRotationDeg * 1.6))
      }

      // A timer rather than transitionend: it fires once, and fires even when a
      // transition is skipped (background tab, reduced motion).
      window.setTimeout(() => callbacks.current.onExited(), MOTION.flingMs + 20)
    },
    [write, writeStage, setDragging],
  )

  const snapBack = useCallback(() => {
    g.current.dx = 0
    g.current.dy = 0
    write(0, 0) // the CSS transition (ease-out-back) does the organic settle
  }, [write])

  // New top card → clear everything synchronously, before paint, so the card
  // that just rose to the top inherits a perfectly neutral state.
  useLayoutEffect(() => {
    const s = g.current
    s.locked = false
    s.tracking = s.dragging = false
    s.dx = s.dy = 0
    s.grabSign = 1
    writeStage(0)
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
    s.samples = [{ x: e.clientX, t: e.timeStamp }]
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const s = g.current
      if (!s.tracking || e.pointerId !== s.pointerId) return
      s.dx = e.clientX - s.startX
      s.dy = e.clientY - s.startY

      if (!s.dragging) {
        if (Math.hypot(s.dx, s.dy) < MOTION.slopPx) return
        // Mostly-vertical movement on touch = page scroll, not a swipe.
        if (e.pointerType === 'touch' && Math.abs(s.dy) > Math.abs(s.dx)) {
          s.tracking = false
          return
        }
        // Capture only once it's a real drag, so taps still reach child buttons.
        s.dragging = true
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragging(true)
      }

      s.samples.push({ x: e.clientX, t: e.timeStamp })
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

      const first = s.samples[0]
      const last = s.samples[s.samples.length - 1]
      const velocity = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0
      const width = cardRef.current?.offsetWidth ?? 1
      const distance = width * MOTION.commitRatio

      const flicked = Math.abs(velocity) > MOTION.flickVelocity && Math.sign(velocity) === Math.sign(s.dx) && Math.abs(s.dx) > 24
      if (e.type !== 'pointercancel' && (Math.abs(s.dx) > distance || flicked)) {
        fling(s.dx > 0 ? 'like' : 'pass', velocity)
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

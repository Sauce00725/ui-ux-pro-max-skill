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
 *   on the card   --drag-x, --drag-y, --drag-rot, --drag-origin,
 *                 --tilt-x, --tilt-y, --light-x, --light-y,
 *                 [data-lit] while a finger or mouse is on it
 *   on the stage  --swipe-amount, --like-strength, --pass-strength, --super-strength
 *
 * The stage variables are inherited by everything inside it, so stacked cards,
 * stamps, ambient glows and control buttons all react to the same gesture with
 * zero extra wiring (see styles/components.css).
 *
 * Tilt makes the card a physical object: the spot you press sinks away from
 * you, the glare sits under your finger, and dragging turns the card toward
 * the throw. A hovering mouse (desktop) moves only the light, not the tilt,
 * so text stays crisp while you read. All of it is off under
 * prefers-reduced-motion.
 *
 * Right = like, left = pass, up = Super Like. Whichever axis dominates wins.
 */

export const MOTION = {
  flingMs: 380,
  snapMs: 720,
  maxRotationDeg: 16,
  commitRatio: 0.32, // of card width (like/pass)
  superRatio: 0.22, // of card height (Super Like)
  flickVelocity: 0.5, // px/ms
  slopPx: 6, // movement before a press becomes a drag (taps stay clicks)
  verticalDamping: 0.35, // during a sideways drag
  upFollow: 0.75, // during an upward (Super Like) drag
  blockedUpDamping: 0.12, // upward drag with no Super Like left: rubber-band
  grabTilt: 0.6, // tilt toward the pressed spot (of the max, see --tilt-max)
  dragTiltX: 0.8, // extra tilt per card-width dragged sideways
  dragTiltY: 0.5, // extra tilt per card-height dragged vertically
  hoverLight: 0.9, // desktop: how far the light follows a hovering mouse
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
  const callbacks = useRef({ onCommit, onExited, enabled, canSuper })
  callbacks.current = { onCommit, onExited, enabled, canSuper }

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
    grabX: 0, // where it was pressed, -1 (left/top edge) … +1 (right/bottom edge)
    grabY: 0,
    hoverX: 0,
    hoverY: 0,
    samples: [] as Sample[],
    frame: 0,
  })
  const reducedMotion = useRef(false)
  const canHover = useRef(false)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => {
      reducedMotion.current = motion.matches
      canHover.current = hover.matches
    }
    sync()
    motion.addEventListener('change', sync)
    hover.addEventListener('change', sync)
    return () => {
      motion.removeEventListener('change', sync)
      hover.removeEventListener('change', sync)
    }
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

  /** Light position (-1…1 per axis) + the lit state that shows the glare and foil. */
  const setLight = (el: HTMLElement, x: number, y: number, lit = true) => {
    if (reducedMotion.current) return
    el.style.setProperty('--light-x', clamp(x, -1, 1).toFixed(3))
    el.style.setProperty('--light-y', clamp(y, -1, 1).toFixed(3))
    if (lit) el.setAttribute('data-lit', '')
    else el.removeAttribute('data-lit')
  }
  /** Tilt the face toward (x, y), with the light following. */
  const setTilt = (el: HTMLElement, x: number, y: number, lit = true) => {
    if (reducedMotion.current) return
    el.style.setProperty('--tilt-x', clamp(x, -1, 1).toFixed(3))
    el.style.setProperty('--tilt-y', clamp(y, -1, 1).toFixed(3))
    setLight(el, x, y, lit)
  }
  const restTilt = (el: HTMLElement | null) => el && setTilt(el, 0, 0, false)

  /** Map raw pointer offset → card transform + stage signals. */
  const write = useCallback(
    (dx: number, dy: number) => {
      const el = cardRef.current
      if (!el) return
      const width = el.offsetWidth || 1
      const height = el.offsetHeight || 1
      const goingUp = -dy > Math.abs(dx)
      const s = g.current
      if (s.tracking) {
        setTilt(
          el,
          s.grabX * MOTION.grabTilt + (dx / width) * MOTION.dragTiltX,
          s.grabY * MOTION.grabTilt + (dy / height) * MOTION.dragTiltY,
        )
      }

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
        : clamp((dx / width) * MOTION.maxRotationDeg * s.grabSign, -MOTION.maxRotationDeg, MOTION.maxRotationDeg)
      setCard(el, dx, dy * MOTION.verticalDamping, rot)
      writeStage(clamp(dx / (width * MOTION.commitRatio), -1, 1), 0)
    },
    [writeStage],
  )

  const schedule = useCallback(() => {
    if (g.current.frame) return
    g.current.frame = requestAnimationFrame(() => {
      const s = g.current
      s.frame = 0
      if (s.tracking) write(s.dx, s.dy)
      else if (cardRef.current && !s.locked) {
        setLight(cardRef.current, s.hoverX * MOTION.hoverLight, s.hoverY * MOTION.hoverLight)
      }
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
      const s = g.current
      if (!el || s.locked || !callbacks.current.enabled) return
      if (direction === 'super' && !callbacks.current.canSuper) return
      s.locked = true
      cancelAnimationFrame(s.frame)
      s.frame = 0
      setDragging(false)

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
          const lift = s.dx !== 0 ? s.dy * MOTION.verticalDamping * 2 : -30
          setCard(el, sign * travel, lift, sign * s.grabSign * MOTION.maxRotationDeg * 1.6)
        }
      }

      // A timer rather than transitionend: it fires once, and fires even when a
      // transition is skipped (background tab, reduced motion).
      window.setTimeout(() => callbacks.current.onExited(), MOTION.flingMs + 20)
    },
    [writeStage, setDragging],
  )

  const snapBack = useCallback(() => {
    g.current.dx = 0
    g.current.dy = 0
    write(0, 0) // the CSS transition (a spring) does the organic settle
    restTilt(cardRef.current)
  }, [write])

  // New top card → clear everything synchronously, before paint, so the card
  // that just rose to the top inherits a perfectly neutral state.
  useLayoutEffect(() => {
    const s = g.current
    s.locked = false
    s.tracking = s.dragging = false
    s.dx = s.dy = 0
    s.grabSign = 1
    s.grabX = s.grabY = 0
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
    // The pressed spot sinks under the finger, before any movement.
    s.grabX = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
    s.grabY = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1)
    setTilt(e.currentTarget, s.grabX * MOTION.grabTilt, s.grabY * MOTION.grabTilt)

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
      if (!s.tracking) {
        // Desktop hover: the light follows the mouse.
        if (e.pointerType !== 'mouse' || !canHover.current || s.locked || !callbacks.current.enabled) return
        const rect = e.currentTarget.getBoundingClientRect()
        s.hoverX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        s.hoverY = ((e.clientY - rect.top) / rect.height) * 2 - 1
        return schedule()
      }
      if (e.pointerId !== s.pointerId) return
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
      if (!s.dragging) {
        // It was a tap: settle the tilt. A mouse keeps hovering, so its light stays on.
        restTilt(cardRef.current)
        if (e.pointerType === 'mouse' && canHover.current) {
          const el = cardRef.current
          if (el) setLight(el, s.hoverX * MOTION.hoverLight, s.hoverY * MOTION.hoverLight)
        }
        return
      }
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

  const onPointerLeave = useCallback(() => {
    if (!g.current.tracking && !g.current.locked) restTilt(cardRef.current)
  }, [])

  return {
    cardRef,
    fling,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onPointerLeave,
    },
    /** Shares motion timing with CSS so JS timers and transitions can't drift. */
    stageStyle: {
      '--dur-fling': `${MOTION.flingMs}ms`,
      '--dur-snap': `${MOTION.snapMs}ms`,
    } as React.CSSProperties,
  }
}

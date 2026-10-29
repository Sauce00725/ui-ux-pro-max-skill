'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'

/*
 * One 1-second clock for every countdown on the page. While anything is
 * listening it ticks; when the last countdown unmounts it stops.
 */
let now = Date.now()
let timer = 0
const listeners = new Set<() => void>()

function subscribeClock(onTick: () => void) {
  listeners.add(onTick)
  if (listeners.size === 1) {
    now = Date.now() // fresh as soon as the first countdown appears
    timer = window.setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    listeners.delete(onTick)
    if (listeners.size === 0) window.clearInterval(timer)
  }
}
const noClock = () => () => {}
const readClock = () => now
const readServerClock = () => null // the server renders a placeholder; the browser fills in the time

/**
 * Milliseconds until `target` (ISO string), ticking every second.
 * Returns null on the server and during hydration so both markups match.
 */
export function useCountdown(target: string | null, onElapsed?: () => void) {
  const clock = useSyncExternalStore<number | null>(target ? subscribeClock : noClock, readClock, readServerClock)
  const fired = useRef<string | null>(null)

  const ms = target && clock !== null ? Math.max(0, Date.parse(target) - clock) : null

  useEffect(() => {
    if (target && ms === 0 && fired.current !== target) {
      fired.current = target
      onElapsed?.()
    }
  }, [ms, target, onElapsed])

  return ms
}

export function formatRemaining(ms: number) {
  const totalMin = Math.ceil(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (totalMin > 1) return `${m}m`
  return `${Math.ceil(ms / 1000)}s`
}

/** HUD clock: T-04:12:08 */
export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `T-${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

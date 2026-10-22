'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Milliseconds until `target` (ISO string), ticking every second.
 * Returns null until mounted so server and client markup match.
 */
export function useCountdown(target: string | null, onElapsed?: () => void) {
  const [now, setNow] = useState<number | null>(null)
  const fired = useRef<string | null>(null)

  useEffect(() => {
    setNow(Date.now())
    if (!target) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [target])

  const ms = target && now !== null ? Math.max(0, Date.parse(target) - now) : null

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

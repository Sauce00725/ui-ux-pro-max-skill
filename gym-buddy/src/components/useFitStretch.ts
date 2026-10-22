'use client'

import { useLayoutEffect, useRef } from 'react'

/**
 * Fits one line of display type to its box by condensing the display face's
 * width axis (font-stretch) instead of truncating: starts at `max` and
 * narrows until the text fits, down to `min`. Refits when the box resizes or
 * the web font loads.
 *
 * The element needs a width that doesn't depend on its text (e.g. flex-1
 * min-w-0) and nowrap. Pair it with a fitStretch() guess in `style`, so the
 * server-rendered first paint is already close.
 */
export function useFitStretch<T extends HTMLElement>(text: string, { max = 75, min = 50 } = {}) {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let active = true
    const fit = () => {
      if (!active) return
      let stretch = max
      el.style.fontStretch = `${stretch}%`
      // Width scales roughly with stretch, so a few proportional steps converge.
      for (let i = 0; i < 4 && el.scrollWidth > el.clientWidth && stretch > min; i++) {
        stretch = Math.max(min, Math.floor((stretch * el.clientWidth) / el.scrollWidth))
        el.style.fontStretch = `${stretch}%`
      }
    }
    fit()
    document.fonts?.ready.then(fit)
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [text, max, min])

  return ref
}

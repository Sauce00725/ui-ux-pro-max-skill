'use client'

import { usePathname, useSearchParams } from 'next/navigation'

/** Where each destination sits along the dock, left to right. A detail screen sits half a step past its tab. */
function place(pathname: string, mode: string | null) {
  if (pathname.startsWith('/discover')) return mode === 'dating' ? 0 : 1
  if (pathname.startsWith('/likes')) return 2
  if (pathname.startsWith('/events')) return pathname === '/events' ? 3 : 3.5
  if (pathname.startsWith('/matches')) return pathname === '/matches' ? 4 : 4.5
  if (pathname.startsWith('/settings')) return 5
  return 0
}

// Where we were, kept across navigations. Updating it is idempotent for the same
// place, so a double render (Strict Mode) can't turn "forward" into "no move".
let current: number | null = null
let previous: number | null = null

/**
 * Each screen slides in from the direction you travelled: forward along the
 * dock from the right, back from the left, and just up on the first load. The
 * key makes a change of tab or mode replay it (a template remounts per segment,
 * and `?mode=` is not a segment).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const mode = useSearchParams().get('mode')
  const here = place(pathname, mode)
  if (here !== current) {
    previous = current
    current = here
  }
  const dir = previous === null ? 'up' : here > previous ? 'fwd' : 'back'

  return (
    <div key={`${pathname}?${mode ?? ''}`} className="page-enter" data-dir={dir}>
      {children}
    </div>
  )
}

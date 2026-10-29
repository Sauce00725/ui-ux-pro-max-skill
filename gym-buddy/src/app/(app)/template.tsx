'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

/** Where each destination sits along the dock, left to right. A detail screen sits half a step past its tab. */
function place(pathname: string, mode: string | null) {
  if (pathname.startsWith('/discover')) return mode === 'dating' ? 0 : 1
  if (pathname.startsWith('/likes')) return 2
  if (pathname.startsWith('/events')) return pathname === '/events' ? 3 : 3.5
  if (pathname.startsWith('/matches')) return pathname === '/matches' ? 4 : 4.5
  if (pathname.startsWith('/settings')) return 5
  return 0
}

type Dir = 'up' | 'fwd' | 'back'
const direction = (from: number | null, to: number): Dir => (from === null || from === to ? 'up' : to > from ? 'fwd' : 'back')

// Where the previous screen sat. Read while the next screen renders, written once it has shown,
// so the direction is known on the very first frame of the new screen.
const last: { place: number | null } = { place: null }

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
  const key = `${pathname}?${mode ?? ''}`

  // Decided once per screen: later re-renders of the same screen must not replay the slide.
  const [entry, setEntry] = useState(() => ({ key, dir: direction(last.place, here) }))
  if (entry.key !== key) setEntry({ key, dir: direction(last.place, here) })

  useEffect(() => {
    last.place = here
  }, [here])

  return (
    <div key={key} className="page-enter" data-dir={entry.key === key ? entry.dir : direction(last.place, here)}>
      {children}
    </div>
  )
}

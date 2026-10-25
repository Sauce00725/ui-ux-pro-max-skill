import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { bus } from './bus'

/*
 * A small client-side router standing in for Next's. Screens read the current
 * place from here (through the stubbed next/navigation) and the stubbed
 * next/link moves it. History is kept in memory, with pushState as a bonus
 * (so the browser's Back button works) where the page is allowed to use it.
 */

export interface RouterValue {
  /** '/discover' */
  path: string
  /** ?mode=dating */
  search: URLSearchParams
  navigate: (to: string, opts?: { replace?: boolean }) => void
  back: () => void
  /** Re-render the current screen with fresh data. */
  refresh: () => void
  /** Bumps when the demo is reset or fast-forwarded, so screens rebuild from scratch. */
  generation: number
}

const Ctx = createContext<RouterValue | null>(null)

export function useAppRouter(): RouterValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('RouterProvider is missing')
  return v
}

/** '/likes?mode=buddy' → path and params. Relative '?mode=x' keeps the current path. */
function split(to: string, currentPath: string) {
  const url = new URL(to, `http://app${currentPath}`)
  return { path: url.pathname, search: url.search, href: url.pathname + url.search }
}

/** The artifact link can carry a bare #token to open straight onto a screen. */
const TOKENS: Record<string, string> = {
  landing: '/',
  deck: '/discover?mode=buddy',
  dating: '/discover?mode=dating',
  partners: '/discover?mode=buddy',
  likes: '/likes?mode=dating',
  events: '/events',
  chats: '/matches',
  profile: '/settings',
}

export function initialHref(): string {
  try {
    const token = window.location.hash.replace(/^#/, '')
    return TOKENS[token] ?? '/'
  } catch {
    return '/'
  }
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [href, setHref] = useState(initialHref)
  const [, setTick] = useState(0)
  const [generation, setGeneration] = useState(0)
  const hrefRef = useRef(href)
  const stack = useRef<string[]>([])

  const go = useCallback((next: string) => {
    hrefRef.current = next
    setHref(next)
  }, [])

  const navigate = useCallback(
    (to: string, opts?: { replace?: boolean }) => {
      const current = split(hrefRef.current, '/')
      const next = split(to, current.path)
      if (next.href === hrefRef.current) return
      if (!opts?.replace) stack.current.push(hrefRef.current)
      go(next.href)
      try {
        const method = opts?.replace ? 'replaceState' : 'pushState'
        window.history[method]({ href: next.href }, '')
      } catch {
        // not allowed in this frame: in-app navigation still works
      }
      window.scrollTo?.(0, 0)
    },
    [go],
  )

  const back = useCallback(() => {
    const prev = stack.current.pop()
    if (prev !== undefined) go(prev)
    else navigate('/discover?mode=dating', { replace: true })
    window.scrollTo?.(0, 0)
  }, [go, navigate])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  const remount = useCallback(() => setGeneration((g) => g + 1), [])

  useEffect(() => {
    bus.navigate = navigate
    bus.back = back
    bus.refresh = refresh
    bus.remount = remount
    const onPop = (e: PopStateEvent) => {
      const h = (e.state as { href?: string } | null)?.href
      go(h ?? '/')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [navigate, back, refresh, remount, go])

  const value = useMemo<RouterValue>(() => {
    const { path, search } = split(href, '/')
    return { path, search: new URLSearchParams(search), navigate, back, refresh, generation }
  }, [href, navigate, back, refresh, generation])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

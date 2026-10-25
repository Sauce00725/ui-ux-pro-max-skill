'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { CalendarDays, Heart, Inbox, MessageCircle, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/discover?mode=dating', label: 'Match', icon: Heart, isActive: (p: string, m: string | null) => p === '/discover' && m === 'dating' },
  { href: '/discover?mode=buddy', label: 'Partners', icon: Users, isActive: (p: string, m: string | null) => p === '/discover' && m !== 'dating' },
  { href: '/likes', label: 'Likes', icon: Inbox, isActive: (p: string) => p.startsWith('/likes') },
  { href: '/events', label: 'Events', icon: CalendarDays, isActive: (p: string) => p.startsWith('/events') },
  { href: '/matches', label: 'Chats', icon: MessageCircle, isActive: (p: string) => p.startsWith('/matches') },
]

/**
 * Floating glass dock. A slanted volt block slides (spring) to the active tab
 * and stretches while it travels, so switching tabs shows where you went from,
 * not just where you are; the icon you land on pops.
 */
export function BottomNav() {
  const pathname = usePathname()
  const mode = useSearchParams().get('mode')
  const beadRef = useRef<HTMLSpanElement>(null)

  // The chat screen is full-height and has its own header.
  const hidden = /^\/matches\/.+/.test(pathname)
  const activeIndex = TABS.findIndex((t) => t.isActive(pathname, mode))

  // The bead's slide is a CSS transition on --dock-index; the stretch is a one-off
  // on top of it (scale composes with the transform), longer for longer trips.
  const lastIndex = useRef(activeIndex)
  useEffect(() => {
    const from = lastIndex.current
    lastIndex.current = activeIndex
    if (from < 0 || activeIndex < 0 || from === activeIndex) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const stretch = 1 + Math.min(Math.abs(activeIndex - from), 3) * 0.28
    beadRef.current?.animate(
      [{ scale: '1 1' }, { scale: `${stretch} 0.9`, offset: 0.4 }, { scale: '1 1' }],
      { duration: 520, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    )
  }, [activeIndex])

  if (hidden) return null

  return (
    <nav aria-label="Main" className="dock">
      <div
        className="dock-bar glass-strong"
        style={{ '--dock-index': Math.max(0, activeIndex), '--dock-count': TABS.length } as React.CSSProperties}
      >
        <span ref={beadRef} className="dock-bead" data-hidden={activeIndex < 0 || undefined} aria-hidden />
        <ul className="relative grid h-full grid-cols-5">
          {TABS.map(({ href, label, icon: Icon }, i) => {
            const active = i === activeIndex
            return (
              <li key={label}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-medium transition-[color,scale] duration-200 active:scale-90',
                    active ? 'text-on-primary' : 'text-muted-fg hover:text-fg',
                  )}
                >
                  <Icon className={cn('size-[1.375rem]', active && 'dock-pop')} aria-hidden strokeWidth={active ? 2.4 : 2} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

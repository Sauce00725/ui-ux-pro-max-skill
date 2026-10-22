'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
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
 * Floating glass dock. A bead of light glides (spring) to the active tab, so
 * switching tabs shows where you went from, not just where you are.
 */
export function BottomNav() {
  const pathname = usePathname()
  const mode = useSearchParams().get('mode')

  // The chat screen is full-height and has its own header.
  if (/^\/matches\/.+/.test(pathname)) return null
  const activeIndex = TABS.findIndex((t) => t.isActive(pathname, mode))

  return (
    <nav aria-label="Main" className="dock">
      <div
        className="dock-bar glass-strong"
        style={{ '--dock-index': Math.max(0, activeIndex), '--dock-count': TABS.length } as React.CSSProperties}
      >
        <span className="dock-bead" data-hidden={activeIndex < 0 || undefined} aria-hidden />
        <ul className="relative grid h-full grid-cols-5">
          {TABS.map(({ href, label, icon: Icon }, i) => {
            const active = i === activeIndex
            return (
              <li key={label}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.6875rem] font-medium transition-colors duration-200',
                    active ? 'text-primary [text-shadow:0_0_12px_rgb(34_230_255/0.55)]' : 'text-muted-fg hover:text-fg',
                  )}
                >
                  <Icon className="size-[1.375rem]" aria-hidden strokeWidth={active ? 2.4 : 2} />
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

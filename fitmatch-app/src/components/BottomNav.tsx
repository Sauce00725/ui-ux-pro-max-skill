'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { CalendarDays, Heart, MessageCircle, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/discover?mode=dating', label: 'Match', icon: Heart, isActive: (p: string, m: string | null) => p === '/discover' && m === 'dating' },
  { href: '/discover?mode=buddy', label: 'Buddies', icon: Users, isActive: (p: string, m: string | null) => p === '/discover' && m !== 'dating' },
  { href: '/events', label: 'Events', icon: CalendarDays, isActive: (p: string) => p.startsWith('/events') },
  { href: '/matches', label: 'Chats', icon: MessageCircle, isActive: (p: string) => p.startsWith('/matches') },
]

export function BottomNav() {
  const pathname = usePathname()
  const mode = useSearchParams().get('mode')

  // The chat screen is full-height and has its own header.
  if (/^\/matches\/.+/.test(pathname)) return null

  return (
    <nav aria-label="Main" className="glass-strong fixed inset-x-0 bottom-0 z-40 rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] shadow-none">
      <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
        {TABS.map(({ href, label, icon: Icon, isActive }) => {
          const active = isActive(pathname, mode)
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-fg hover:text-fg',
                )}
              >
                <Icon className="size-6" aria-hidden strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

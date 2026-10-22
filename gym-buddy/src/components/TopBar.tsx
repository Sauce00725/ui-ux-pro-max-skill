'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'

/** Brand + profile entry point. Hidden on the full-screen chat view. */
export function TopBar() {
  const pathname = usePathname()
  if (/^\/matches\/.+/.test(pathname)) return null
  const onSettings = pathname.startsWith('/settings')

  return (
    <header className="topbar">
      <div className="mx-auto flex h-(--topbar-height) max-w-md items-center justify-between px-(--space-gutter)">
        <Link href="/discover" aria-label="Gym Buddy home" className="rounded-full">
          <Logo size="sm" />
        </Link>
        <Link
          href="/settings"
          aria-label="Profile and settings"
          aria-current={onSettings ? 'page' : undefined}
          className={cn(
            'glass glass-flat grid size-11 place-items-center rounded-full transition-colors duration-200',
            onSettings ? 'border-primary/70 text-primary' : 'text-fg hover:text-primary',
          )}
        >
          <UserRound className="size-5" aria-hidden />
        </Link>
      </div>
    </header>
  )
}

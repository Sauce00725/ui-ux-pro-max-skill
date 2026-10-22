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
    <header className="sticky top-0 z-40 border-b border-[color:var(--glass-stroke)] bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-(--space-gutter)">
        <Link href="/discover" aria-label="Gym Buddy home">
          <Logo size="sm" />
        </Link>
        <Link
          href="/settings"
          aria-label="Profile and settings"
          aria-current={onSettings ? 'page' : undefined}
          className={cn(
            'grid size-11 place-items-center rounded-full border transition-colors',
            onSettings
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-[color:var(--glass-stroke-strong)] bg-[color:var(--glass-fill)] text-fg hover:border-primary hover:text-primary',
          )}
        >
          <UserRound className="size-5" aria-hidden />
        </Link>
      </div>
    </header>
  )
}

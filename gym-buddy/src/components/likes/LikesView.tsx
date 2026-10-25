import Link from 'next/link'
import { LikesInbox } from '@/components/likes/LikesInbox'
import type { AppMode, LikeReceived } from '@/lib/types'
import { cn } from '@/lib/utils'

/** The Likes screen. The page fetches; this only lays out (so the prototype can render it with demo data). */
export function LikesView({ mode, likes }: { mode: AppMode; likes: LikeReceived[] }) {
  return (
    <main className="mx-auto max-w-md px-(--space-gutter) pt-3">
      <p className="hud-label text-primary">// Incoming signals</p>
      <h1 className="font-display text-title font-bold uppercase">Likes</h1>
      <p className="mt-1 text-sm text-muted-fg">
        People who liked you first. Like them back to match, and it doesn’t use a pick.
      </p>

      <nav aria-label="Mode" className="mt-4 grid grid-cols-2 gap-2">
        {(['dating', 'buddy'] as const).map((m) => (
          <Link
            key={m}
            href={`/likes?mode=${m}`}
            aria-current={m === mode ? 'page' : undefined}
            className={cn(
              'flex h-11 items-center justify-center rounded-panel border font-mono text-xs uppercase tracking-[0.14em] transition-colors',
              m === mode ? 'border-primary bg-primary/10 text-primary' : 'text-muted-fg hover:text-fg',
            )}
          >
            {m === 'dating' ? 'Dating' : 'Training Partners'}
          </Link>
        ))}
      </nav>

      {/* key: reset local list state when switching modes */}
      <LikesInbox key={mode} mode={mode} initialLikes={likes} />
    </main>
  )
}

import Link from 'next/link'
import { Heart, Users } from 'lucide-react'
import { Avatar } from '@/components/Avatar'

export interface MatchRow {
  id: string
  mode: string
  last_message_at: string | null
  other: { id: string; display_name: string }
}

/** The Chats screen: new matches across the top, conversations below. The page fetches; this only lays out. */
export function MatchesView({ rows, avatars }: { rows: MatchRow[]; avatars: Record<string, string | undefined> }) {
  const fresh = rows.filter((r) => !r.last_message_at)
  const convos = rows.filter((r) => r.last_message_at)

  return (
    <main className="mx-auto max-w-md px-4 pt-4">
      <h1 className="font-display text-3xl font-bold uppercase">Chats</h1>

      {rows.length === 0 && (
        <p className="mt-10 text-center text-muted-fg">
          No matches yet. Keep swiping, or <Link href="/events" className="text-primary underline">join an event</Link>.
        </p>
      )}

      {fresh.length > 0 && (
        <section className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-fg">New matches</h2>
          <ul className="cascade -mx-4 mt-3 flex gap-4 overflow-x-auto px-4 pb-2">
            {fresh.map((m) => (
              <li key={m.id} className="shrink-0">
                <Link href={`/matches/${m.id}`} className="flex w-20 flex-col items-center gap-1.5">
                  <Avatar url={avatars[m.other.id]} name={m.other.display_name} size="lg" ring />
                  <span className="w-full truncate text-center text-sm">{m.other.display_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {convos.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-fg">Messages</h2>
          <ul className="cascade mt-2 divide-y">
            {convos.map((m) => (
              <li key={m.id}>
                <Link href={`/matches/${m.id}`} className="flex min-h-16 items-center gap-3 py-3 transition-colors hover:bg-surface">
                  <Avatar url={avatars[m.other.id]} name={m.other.display_name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.other.display_name}</p>
                    <p className="flex items-center gap-1 text-sm text-muted-fg">
                      {m.mode === 'dating' ? <Heart className="size-3.5" aria-hidden /> : <Users className="size-3.5" aria-hidden />}
                      {m.mode === 'dating' ? 'Dating' : 'Training partner'}
                    </p>
                  </div>
                  <time className="text-xs text-muted-fg" dateTime={m.last_message_at!}>
                    {new Date(m.last_message_at!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

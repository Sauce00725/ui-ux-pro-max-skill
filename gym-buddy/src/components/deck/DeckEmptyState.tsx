'use client'

import Link from 'next/link'
import { CalendarDays, Hourglass, MessageCircle, RefreshCw, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { AppMode } from '@/lib/types'
import type { DeckView } from './deckState'
import { formatClock, formatRemaining, useCountdown } from './useCountdown'

type EmptyView = Exclude<DeckView, { kind: 'deck' }>

export function DeckEmptyState({ view, mode, onRefresh }: { view: EmptyView; mode: AppMode; onRefresh: () => void }) {
  if (view.kind === 'loading') {
    return (
      <div className="glass absolute inset-0 bottom-[calc(var(--space-stack)*2)] animate-pulse rounded-card" role="status">
        <span className="sr-only">Loading your selection…</span>
      </div>
    )
  }

  if (view.kind === 'quota-exhausted') {
    return <QuotaExhausted resetsAt={view.resetsAt} windowSeconds={view.windowSeconds} />
  }

  return (
    <Panel icon={<Users className="size-7" aria-hidden />} title="No one new nearby">
      <p>
        You’ve seen everyone who fits your {mode === 'dating' ? 'dating' : 'training partner'} preferences right now. Widen your
        distance, or meet people in person at a local event.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={onRefresh}><RefreshCw className="size-4" aria-hidden /> Refresh</Button>
        <LinkButton href="/events" icon={<CalendarDays className="size-4" aria-hidden />}>Browse events</LinkButton>
      </div>
    </Panel>
  )
}

function QuotaExhausted({ resetsAt, windowSeconds }: { resetsAt: string | null; windowSeconds: number }) {
  const ms = useCountdown(resetsAt)
  const R = 52
  const C = 2 * Math.PI * R
  const elapsed = ms === null ? 0 : 1 - ms / (windowSeconds * 1000)

  return (
    <Panel
      icon={
        <div className="relative grid size-32 place-items-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--meter-track)" strokeWidth="2" strokeDasharray="2 4" />
            <circle
              cx="60" cy="60" r={R} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - elapsed)}
              style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 6px var(--color-primary))' }}
            />
          </svg>
          <div className="text-center">
            <Hourglass className="mx-auto size-5 text-primary" aria-hidden />
            <p className="mt-1 font-mono text-sm tabular-nums text-fg title-glow">{ms === null ? '—' : formatClock(ms)}</p>
          </div>
        </div>
      }
      title="That’s your selection"
    >
      <p>
        Slow dating means fewer, better conversations. Your next {Math.round(windowSeconds / 3600)}-hour selection
        unlocks {ms === null ? 'soon' : `in ${formatRemaining(ms)}`}.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <LinkButton href="/matches" icon={<MessageCircle className="size-4" aria-hidden />}>Reply to matches</LinkButton>
        <LinkButton href="/events" icon={<CalendarDays className="size-4" aria-hidden />} primary>Find an event</LinkButton>
      </div>
    </Panel>
  )
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="glass absolute inset-0 bottom-[calc(var(--space-stack)*2)] flex flex-col items-center justify-center rounded-card p-(--space-card) text-center">
      <div className="text-primary">{icon}</div>
      <h2 className="mt-5 font-display text-title font-extrabold uppercase">{title}</h2>
      <p className="hud-label mt-1 text-primary" aria-hidden>// standby</p>
      <div className="mt-2 max-w-xs text-muted-fg">{children}</div>
    </section>
  )
}

function LinkButton({ href, icon, primary, children }: { href: string; icon: React.ReactNode; primary?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        primary
          ? 'btn-holo inline-flex h-12 items-center gap-2 rounded-full px-6 font-semibold'
          : 'glass glass-flat inline-flex h-12 items-center gap-2 rounded-full px-6 font-semibold transition-colors duration-200 hover:bg-(--glass-fill-hover)'
      }
    >
      {icon}
      {children}
    </Link>
  )
}

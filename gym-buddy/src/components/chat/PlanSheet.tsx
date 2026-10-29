'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { CalendarHeart, ChevronRight, MapPin, ShieldCheck, Sparkles, X } from 'lucide-react'
import { dayLabel } from '@/components/events/format'
import { dateIdeasFor, SAFETY_TIPS } from '@/lib/conversation'
import type { AppMode, EventItem } from '@/lib/types'

/** "Want to go to Sunrise 5K Social Run together? It’s tomorrow at 6:30 AM, Lady Bird Lake Trail." */
function eventPitch(e: EventItem) {
  const day = dayLabel(e.startsAt)
  const when = day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : `on ${day}`
  const start = new Date(e.startsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `Want to go to ${e.title} together? It’s ${when} at ${start}, ${e.venueName}.`
}

/**
 * Plan a date (or, for training partners, a session): local events this week
 * that fit what you both do, active ideas, a low-key one, and first-meetup
 * safety. Picking one fills the message box; it's sent only when you send it.
 */
export function PlanSheet({
  mode,
  name,
  events,
  sharedActivities,
  onPick,
  onClose,
}: {
  mode: AppMode
  name: string
  events: EventItem[]
  sharedActivities: string[]
  onPick: (text: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const pick = (text: string) => {
    onPick(text)
    ref.current?.close()
  }
  const ideas = dateIdeasFor({ mode, sharedActivities })
  const noun = mode === 'dating' ? 'date' : 'session'

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="plan-title"
      className="glass-strong mx-auto mb-0 mt-auto max-h-[88dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-card rounded-b-none p-(--space-card) pb-[max(var(--space-card),env(safe-area-inset-bottom))] text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:m-auto sm:rounded-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="hud-label text-primary">// Plan a {noun}</p>
          <h2 id="plan-title" className="mt-1 font-display text-title font-bold uppercase">
            Do something with {name}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-200 hover:bg-(--glass-fill-hover)"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-fg">Pick one to put it in your message, ready to edit. Nothing sends until you do.</p>

      {events.length > 0 && (
        <section className="mt-5" aria-labelledby="plan-events">
          <h3 id="plan-events" className="hud-label flex items-center gap-1.5 text-primary">
            <CalendarHeart className="size-3.5" aria-hidden /> Near you this week
          </h3>
          <ul className="mt-2 space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => pick(eventPitch(e))}
                  className="glass glass-flat min-w-0 flex-1 rounded-panel px-3 py-2.5 text-left transition-colors duration-200 hover:bg-(--glass-fill-hover)"
                >
                  <span className="block truncate font-semibold">{e.title}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-fg">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      {dayLabel(e.startsAt)} · {e.venueName}
                      {e.distanceMi !== null ? ` · ${e.distanceMi} mi` : ''}
                    </span>
                  </span>
                </button>
                <Link
                  href={`/events/${e.id}`}
                  aria-label={`Details for ${e.title}`}
                  className="glass glass-flat grid w-11 shrink-0 place-items-center rounded-panel transition-colors duration-200 hover:bg-(--glass-fill-hover)"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5" aria-labelledby="plan-ideas">
        <h3 id="plan-ideas" className="hud-label flex items-center gap-1.5 text-primary">
          <Sparkles className="size-3.5" aria-hidden /> {sharedActivities.length ? 'Ideas you’d both like' : 'Easy ideas'}
        </h3>
        <ul className="mt-2 space-y-2">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <button
                type="button"
                onClick={() => pick(idea.pitch)}
                className="glass glass-flat w-full rounded-panel px-3 py-2.5 text-left transition-colors duration-200 hover:bg-(--glass-fill-hover)"
              >
                <span className="block font-semibold">{idea.title}</span>
                <span className="mt-0.5 block text-sm text-muted-fg">{idea.pitch}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5 rounded-panel border border-[color:var(--glass-stroke)] p-3" aria-labelledby="plan-safety">
        <h3 id="plan-safety" className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" aria-hidden /> {mode === 'dating' ? 'First-date safety' : 'Meeting up safely'}
        </h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-fg">
          {SAFETY_TIPS[mode].map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
          <li>You can block or report from the ⋮ menu at any time.</li>
        </ul>
      </section>
    </dialog>
  )
}

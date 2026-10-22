'use client'

import { useState, useTransition } from 'react'
import { Check, Plus } from 'lucide-react'
import { setRsvp } from '@/app/(app)/events/actions'
import { cn } from '@/lib/utils'

/** Quick RSVP from a list card. Privacy (show me as going) is set on the detail page. */
export function RsvpButton({
  eventId,
  title,
  initialGoing,
  showMe,
  full,
}: {
  eventId: string
  title: string
  initialGoing: boolean
  showMe: boolean
  full: boolean
}) {
  const [going, setGoing] = useState(initialGoing)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  const toggle = () =>
    startTransition(async () => {
      const next = !going
      setGoing(next) // optimistic
      setError(undefined)
      const res = await setRsvp({ eventId, going: next, showMe })
      if (!res.ok) {
        setGoing(!next)
        setError(res.message)
      }
    })

  const disabled = pending || (full && !going)
  return (
    <div className="relative z-10 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={going}
        aria-label={going ? `You’re going to ${title}. Tap to cancel.` : `RSVP to ${title}`}
        className={cn(
          'inline-flex h-10 min-w-24 items-center justify-center gap-1.5 rounded-panel border px-3 font-mono text-xs uppercase tracking-[0.12em] transition-[background-color,box-shadow,color] duration-200',
          going
            ? 'border-primary bg-primary text-on-primary shadow-[0_0_18px_-4px_var(--color-primary)]'
            : 'border-[color:var(--glass-stroke-strong)] bg-[color:var(--glass-fill)] text-fg hover:border-primary hover:text-primary',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {going ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        {going ? 'Going' : full ? 'Full' : 'RSVP'}
      </button>
      {error && <p role="alert" className="max-w-40 text-right text-xs text-danger">{error}</p>}
    </div>
  )
}

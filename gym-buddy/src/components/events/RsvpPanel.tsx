'use client'

import { useState, useTransition } from 'react'
import { Check, Eye, EyeOff } from 'lucide-react'
import { setRsvp } from '@/app/(app)/events/actions'
import { Button } from '@/components/ui/Button'

/** RSVP + privacy: going is private unless you opt in to showing it. */
export function RsvpPanel({
  eventId,
  initialGoing,
  initialShowMe,
  full,
}: {
  eventId: string
  initialGoing: boolean
  initialShowMe: boolean
  full: boolean
}) {
  const [going, setGoing] = useState(initialGoing)
  const [showMe, setShowMe] = useState(initialShowMe)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  const save = (next: { going: boolean; showMe: boolean }) =>
    startTransition(async () => {
      const prev = { going, showMe }
      setGoing(next.going)
      setShowMe(next.showMe)
      setError(undefined)
      const res = await setRsvp({ eventId, ...next })
      if (!res.ok) {
        setGoing(prev.going)
        setShowMe(prev.showMe)
        setError(res.message)
      }
    })

  return (
    <div className="space-y-3">
      <Button
        className="w-full"
        variant={going ? 'secondary' : 'primary'}
        loading={pending}
        disabled={full && !going}
        onClick={() => save({ going: !going, showMe })}
        aria-pressed={going}
      >
        {going ? <><Check className="size-4" aria-hidden /> You’re going (tap to cancel)</> : full ? 'Event is full' : 'RSVP: I’m going'}
      </Button>

      <label className="flex cursor-pointer items-start gap-3 rounded-panel border border-[color:var(--glass-stroke)] bg-[color:var(--glass-fill)] p-3">
        <input
          type="checkbox"
          checked={showMe}
          disabled={pending}
          onChange={(e) => save({ going: going || e.target.checked, showMe: e.target.checked })}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span className="text-sm">
          <span className="flex items-center gap-1.5 font-semibold">
            {showMe ? <Eye className="size-4 text-primary" aria-hidden /> : <EyeOff className="size-4 text-muted-fg" aria-hidden />}
            Show me as going
          </span>
          <span className="block text-muted-fg">
            Off by default. When on, other members see your first name and photo here, a good way to find a training partner for it.
          </span>
        </span>
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  )
}

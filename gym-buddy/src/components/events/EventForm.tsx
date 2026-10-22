'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { LocateFixed, MapPin } from 'lucide-react'
import { createEvent } from '@/app/(app)/events/actions'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { eventSchema, toFieldErrors, US_STATES } from '@/lib/validation'
import { cn } from '@/lib/utils'

const DURATIONS = [30, 45, 60, 90, 120, 180, 240] as const

const todayLocal = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export function EventForm({
  activities,
  defaultCity,
  defaultState,
}: {
  activities: { slug: string; name: string }[]
  defaultCity: string
  defaultState: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [locating, setLocating] = useState(false)
  const [v, setV] = useState({
    title: '',
    activitySlug: '',
    date: '',
    time: '07:00',
    duration: 60,
    venueName: '',
    address: '',
    city: defaultCity,
    state: defaultState,
    lat: null as number | null,
    lng: null as number | null,
    url: '',
    beginnerFriendly: true,
    cost: '0',
    capacity: '',
    description: '',
  })
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => {
    setV((s) => ({ ...s, [k]: value }))
    setErrors((e) => {
      const { [k as string]: _drop, ...rest } = e
      return rest
    })
  }

  function payload() {
    // Local date + time → ISO with this browser's offset (the organizer's timezone).
    const start = v.date ? new Date(`${v.date}T${v.time}`) : null
    const valid = start && !Number.isNaN(start.getTime())
    return {
      title: v.title,
      activitySlug: v.activitySlug || null,
      startsAt: valid ? start!.toISOString() : '',
      endsAt: valid ? new Date(start!.getTime() + v.duration * 60_000).toISOString() : '',
      venueName: v.venueName,
      address: v.address,
      city: v.city,
      state: v.state,
      lat: v.lat,
      lng: v.lng,
      url: v.url,
      beginnerFriendly: v.beginnerFriendly,
      costDollars: v.cost === '' ? NaN : Number(v.cost),
      capacity: v.capacity ? Number(v.capacity) : null,
      description: v.description,
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const data = payload()
    const check = eventSchema.safeParse(data)
    if (!check.success) {
      setErrors(toFieldErrors(check.error))
      return
    }
    setFormError(undefined)
    startTransition(async () => {
      const res = await createEvent(data)
      if (!res.ok) {
        setFormError(res.message)
        if (res.fieldErrors) setErrors(res.fieldErrors)
        return
      }
      router.push(`/events/${res.data!.id}`)
    })
  }

  function locate() {
    if (!('geolocation' in navigator)) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setV((s) => ({ ...s, lat: pos.coords.latitude, lng: pos.coords.longitude }))
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const when = errors.startsAt ?? errors.endsAt

  return (
    <form noValidate onSubmit={submit} className="mt-6 space-y-5">
      <Field id="title" label="Event name" error={errors.title}>
        <Input id="title" maxLength={90} value={v.title} error={errors.title}
          placeholder="Saturday 5K social run" onChange={(e) => set('title', e.target.value)} />
      </Field>

      <Field id="activity" label="Activity">
        <Select id="activity" value={v.activitySlug} onChange={(e) => set('activitySlug', e.target.value)}>
          <option value="">Other / mixed</option>
          {activities.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id="date" label="Date" error={when}>
          <Input id="date" type="date" min={todayLocal()} value={v.date} error={when}
            onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field id="time" label="Start time">
          <Input id="time" type="time" step={300} value={v.time} onChange={(e) => set('time', e.target.value)} />
        </Field>
      </div>

      <Field id="duration" label="Length">
        <Select id="duration" value={v.duration} onChange={(e) => set('duration', Number(e.target.value))}>
          {DURATIONS.map((d) => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} hr${d > 60 ? 's' : ''}`}</option>)}
        </Select>
      </Field>

      <Field id="venueName" label="Venue" error={errors.venueName}>
        <Input id="venueName" maxLength={90} value={v.venueName} error={errors.venueName}
          placeholder="Zilker Park, Great Lawn" onChange={(e) => set('venueName', e.target.value)} />
      </Field>
      <Field id="address" label="Address or meeting spot (optional)" error={errors.address}>
        <Input id="address" maxLength={160} value={v.address} error={errors.address}
          placeholder="By the volleyball courts" onChange={(e) => set('address', e.target.value)} />
      </Field>
      <div className="grid grid-cols-[1fr_7rem] gap-4">
        <Field id="ev-city" label="City" error={errors.city}>
          <Input id="ev-city" value={v.city} error={errors.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field id="ev-state" label="State" error={errors.state}>
          <Select id="ev-state" value={v.state} error={errors.state} onChange={(e) => set('state', e.target.value)}>
            <option value="" disabled>—</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={locate}
          className={cn(
            'flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 text-left text-sm transition-colors',
            v.lat !== null ? 'border-accent bg-accent/10' : 'bg-surface hover:border-primary',
          )}
        >
          {v.lat !== null ? <MapPin className="size-5 text-accent" aria-hidden /> : <LocateFixed className="size-5 text-primary" aria-hidden />}
          {locating ? 'Finding the venue…' : v.lat !== null ? 'Pinned to where you are now' : 'I’m at the venue: pin it here'}
        </button>
        <p className="text-sm text-muted-fg/80">
          Optional. Otherwise we place it at your saved area, which is fine for “near me” search.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field id="cost" label="Price (USD)" error={errors.costDollars} hint="0 = free">
          <Input id="cost" type="number" inputMode="decimal" min={0} max={1000} step="0.5" value={v.cost}
            error={errors.costDollars} hint="0 = free" onChange={(e) => set('cost', e.target.value)} />
        </Field>
        <Field id="capacity" label="Spots (optional)" error={errors.capacity}>
          <Input id="capacity" type="number" inputMode="numeric" min={1} value={v.capacity} error={errors.capacity}
            onChange={(e) => set('capacity', e.target.value)} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-surface p-4">
        <input type="checkbox" checked={v.beginnerFriendly} onChange={(e) => set('beginnerFriendly', e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-primary" />
        <span>
          <span className="block font-semibold">Beginner-friendly</span>
          <span className="block text-sm text-muted-fg">No experience needed; nobody gets left behind.</span>
        </span>
      </label>

      <Field id="url" label="Link (optional)" error={errors.url}>
        <Input id="url" type="url" inputMode="url" value={v.url} error={errors.url} placeholder="https://"
          onChange={(e) => set('url', e.target.value)} />
      </Field>

      <Field id="description" label="Details (optional)" error={errors.description} hint={`${v.description.length}/2000`}>
        <Textarea id="description" maxLength={2000} value={v.description} error={errors.description}
          hint={`${v.description.length}/2000`} placeholder="Pace, what to bring, where to find the group…"
          onChange={(e) => set('description', e.target.value)} />
      </Field>

      {formError && <p role="alert" className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm">{formError}</p>}

      <Button type="submit" loading={pending} className="w-full">Submit for review</Button>
    </form>
  )
}

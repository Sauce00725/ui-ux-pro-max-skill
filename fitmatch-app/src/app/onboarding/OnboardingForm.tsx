'use client'

import { useState, useTransition } from 'react'
import { ArrowLeft, Heart, LocateFixed, MapPin, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { PhotoUploader, type UploadedPhoto } from '@/components/PhotoUploader'
import { cn } from '@/lib/utils'
import {
  basicsSchema,
  fitnessSchema,
  modesSchema,
  photosSchema,
  promptsSchema,
  MAX_PROMPTS,
  PROMPTS,
  PROMPT_ANSWER_MAX,
  PROMPT_KEYS,
  type PromptKey,
  toFieldErrors,
  FITNESS_LEVELS,
  GENDERS,
  GENDER_LABELS,
  TRAINING_TIMES,
  TRAINING_TIME_LABELS,
  BEGINNER_MAX_LEVEL,
  GOALS,
  GOAL_LABELS,
  MAX_GOALS,
  US_STATES,
  type ModePrefs,
} from '@/lib/validation'
import { completeOnboarding } from './actions'

type Gender = (typeof GENDERS)[number]
type TrainingTime = (typeof TRAINING_TIMES)[number]
type Goal = (typeof GOALS)[number]

interface Values {
  displayName: string
  birthdate: string
  gender: Gender | ''
  bio: string
  city: string
  state: string
  lat: number | null
  lng: number | null
  activityIds: number[]
  fitnessLevel: number | null
  trainingTimes: TrainingTime[]
  goals: Goal[]
  helpsBeginners: boolean
  modes: { buddy: ModePrefs; dating: ModePrefs }
  prompts: { key: PromptKey; answer: string }[]
  photos: UploadedPhoto[]
}

const defaultMode = (enabled: boolean): ModePrefs => ({
  enabled,
  headline: '',
  minAge: 18,
  maxAge: 99,
  maxDistanceMi: 25,
  interestedIn: [],
})

const STEPS = [
  { title: 'The basics', subtitle: 'Only your first name, age and city are public.', schema: basicsSchema, keys: ['displayName', 'birthdate', 'gender', 'bio', 'city', 'state', 'lat', 'lng'] },
  { title: 'How you move', subtitle: 'Already training or just getting started, we match you on activities, goals and schedules.', schema: fitnessSchema, keys: ['activityIds', 'fitnessLevel', 'trainingTimes', 'goals', 'helpsBeginners'] },
  { title: 'What you’re here for', subtitle: 'Dating and Gym Buddies are separate. Nobody sees a mode you haven’t turned on.', schema: modesSchema, keys: ['modes'] },
  { title: 'Add prompts', subtitle: 'Optional, but prompts give people something to like and an easy first message.', schema: promptsSchema, keys: ['prompts'] },
  { title: 'Add photos', subtitle: 'Clear, recent photos get far more matches. Training shots welcome.', schema: photosSchema, keys: ['photoPaths'] },
] as const

const PLURAL_GENDER_LABELS: Record<Gender, string> = { woman: 'Women', man: 'Men', nonbinary: 'Nonbinary people' }

const toPayload = ({ photos, ...rest }: Values) => ({
  ...rest,
  // Only offered at level 3+; don't keep a stale opt-in if the level changed.
  helpsBeginners: rest.helpsBeginners && (rest.fitnessLevel ?? 0) > BEGINNER_MAX_LEVEL,
  photoPaths: photos.map((p) => p.path),
})

const stepForError = (key: string) =>
  Math.max(0, STEPS.findIndex((s) => s.keys.some((k) => key === k || key.startsWith(`${k}.`))))

export function OnboardingForm({
  userId,
  activities,
  defaultBirthdate,
}: {
  userId: string
  activities: { id: number; name: string }[]
  defaultBirthdate: string
}) {
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<Values>({
    displayName: '',
    birthdate: defaultBirthdate,
    gender: '',
    bio: '',
    city: '',
    state: '',
    lat: null,
    lng: null,
    activityIds: [],
    fitnessLevel: null,
    trainingTimes: [],
    goals: [],
    helpsBeginners: false,
    modes: { buddy: defaultMode(true), dating: defaultMode(false) },
    prompts: [],
    photos: [],
  })

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    // Clear this field's error as soon as the user changes it.
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key && !k.startsWith(`${String(key)}.`))))
  }
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
  const setMode = (mode: 'buddy' | 'dating', patch: Partial<ModePrefs>) =>
    set('modes', { ...values.modes, [mode]: { ...values.modes[mode], ...patch } })

  function next() {
    const result = STEPS[step].schema.safeParse(toPayload(values))
    if (!result.success) {
      setErrors(toFieldErrors(result.error))
      return
    }
    setErrors({})
    if (step < STEPS.length - 1) {
      setStep(step + 1)
      window.scrollTo({ top: 0 })
      return
    }
    setFormError(undefined)
    startTransition(async () => {
      // On success the action redirects, so we only get here on failure.
      const res = await completeOnboarding(toPayload(values))
      if (res && !res.ok) {
        setFormError(res.message)
        if (res.fieldErrors) {
          setErrors(res.fieldErrors)
          setStep(stepForError(Object.keys(res.fieldErrors)[0]))
        }
      }
    })
  }

  const current = STEPS[step]
  const isBeginner = values.fitnessLevel !== null && values.fitnessLevel <= BEGINNER_MAX_LEVEL

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-32 pt-6">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
          aria-label="Previous step"
          className="grid size-11 place-items-center rounded-full text-muted-fg hover:bg-card disabled:invisible"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-card"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label={`Step ${step + 1} of ${STEPS.length}`}
        >
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <span className="w-10 text-right text-sm text-muted-fg">{step + 1}/{STEPS.length}</span>
      </div>

      <h1 className="mt-8 font-display text-4xl font-bold uppercase leading-none">{current.title}</h1>
      <p className="mt-2 text-muted-fg">{current.subtitle}</p>

      <form
        noValidate
        className="mt-8 space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          next()
        }}
      >
        {step === 0 && (
          <>
            <Field id="displayName" label="First name" error={errors.displayName}>
              <Input id="displayName" autoComplete="given-name" value={values.displayName} error={errors.displayName}
                onChange={(e) => set('displayName', e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field id="birthdate" label="Date of birth" error={errors.birthdate}>
                <Input id="birthdate" type="date" value={values.birthdate} error={errors.birthdate}
                  onChange={(e) => set('birthdate', e.target.value)} />
              </Field>
              <Field id="gender" label="I am a" error={errors.gender}>
                <Select id="gender" value={values.gender} error={errors.gender}
                  onChange={(e) => set('gender', e.target.value as Gender)}>
                  <option value="" disabled>Select</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-[1fr_7rem] gap-4">
              <Field id="city" label="City" error={errors.city}>
                <Input id="city" autoComplete="address-level2" value={values.city} error={errors.city}
                  onChange={(e) => set('city', e.target.value)} />
              </Field>
              <Field id="state" label="State" error={errors.state}>
                <Select id="state" value={values.state} error={errors.state}
                  onChange={(e) => set('state', e.target.value)}>
                  <option value="" disabled>—</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>

            <LocationButton
              hasLocation={values.lat !== null}
              error={errors.lat ?? errors.lng}
              onLocate={(lat, lng) => setValues((v) => ({ ...v, lat, lng }))}
              onClearError={() => setErrors(({ lat: _lat, lng: _lng, ...rest }) => rest)}
            />

            <Field id="bio" label="Bio (optional)" error={errors.bio} hint={`${values.bio.length}/500`}>
              <Textarea id="bio" maxLength={500} value={values.bio} error={errors.bio} hint={`${values.bio.length}/500`}
                placeholder="Marathon in training. Will spot you, won’t judge your playlist."
                onChange={(e) => set('bio', e.target.value)} />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-muted-fg">Where are you starting from?</legend>
              <p className="mb-3 text-sm text-muted-fg/80">Every level is welcome, including day one.</p>
              <div className="grid grid-cols-5 gap-2">
                {FITNESS_LEVELS.map((label, i) => (
                  <button key={label} type="button" aria-pressed={values.fitnessLevel === i + 1}
                    onClick={() => set('fitnessLevel', i + 1)}
                    className={cn(
                      'flex min-h-16 flex-col items-center justify-center rounded-xl border px-1 text-xs font-medium transition-colors',
                      values.fitnessLevel === i + 1 ? 'border-primary bg-primary/15 text-fg' : 'bg-surface text-muted-fg hover:border-muted-fg',
                    )}>
                    <span className="font-display text-xl font-bold">{i + 1}</span>
                    {label}
                  </button>
                ))}
              </div>
              {errors.fitnessLevel && <p role="alert" className="mt-2 text-sm text-danger">{errors.fitnessLevel}</p>}
            </fieldset>

            <fieldset>
              <legend className="mb-3 text-sm font-medium text-muted-fg">What are you working toward? (up to {MAX_GOALS})</legend>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((g) => (
                  <Chip key={g} selected={values.goals.includes(g)}
                    onClick={() => {
                      if (!values.goals.includes(g) && values.goals.length >= MAX_GOALS) return
                      set('goals', toggle(values.goals, g))
                    }}>
                    {GOAL_LABELS[g]}
                  </Chip>
                ))}
              </div>
              {errors.goals && <p role="alert" className="mt-2 text-sm text-danger">{errors.goals}</p>}
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-sm font-medium text-muted-fg">Activities you do, or want to try (up to 8)</legend>
              {isBeginner && (
                <p className="mb-3 text-sm text-muted-fg/80">
                  New to this? Walking, home workouts and learning the gym are great places to start.
                </p>
              )}
              <div className={cn('flex flex-wrap gap-2', !isBeginner && 'mt-3')}>
                {activities.map((a) => (
                  <Chip key={a.id} selected={values.activityIds.includes(a.id)}
                    onClick={() => set('activityIds', toggle(values.activityIds, a.id))}>
                    {a.name}
                  </Chip>
                ))}
              </div>
              {errors.activityIds && <p role="alert" className="mt-2 text-sm text-danger">{errors.activityIds}</p>}
            </fieldset>

            <fieldset>
              <legend className="mb-3 text-sm font-medium text-muted-fg">
                {isBeginner ? 'When could you fit in a workout?' : 'When do you usually train?'}
              </legend>
              <div className="flex flex-wrap gap-2">
                {TRAINING_TIMES.map((t) => (
                  <Chip key={t} selected={values.trainingTimes.includes(t)}
                    onClick={() => set('trainingTimes', toggle(values.trainingTimes, t))}>
                    {TRAINING_TIME_LABELS[t]}
                  </Chip>
                ))}
              </div>
            </fieldset>

            {values.fitnessLevel !== null && !isBeginner && (
              <label className="flex cursor-pointer items-start gap-4 rounded-2xl border bg-surface p-4">
                <input
                  type="checkbox"
                  checked={values.helpsBeginners}
                  onChange={(e) => set('helpsBeginners', e.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-primary"
                />
                <span>
                  <span className="block font-semibold">Happy to train with beginners</span>
                  <span className="block text-sm text-muted-fg">
                    People just getting in shape will see you first. You set the pace, no coaching required.
                  </span>
                </span>
              </label>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <ModeCard
              mode="buddy"
              icon={<Users className="size-5" aria-hidden />}
              title="Gym Buddies"
              description="Training partners and friends. Never dating."
              prefs={values.modes.buddy}
              errors={errors}
              onChange={(p) => setMode('buddy', p)}
            />
            <ModeCard
              mode="dating"
              icon={<Heart className="size-5" aria-hidden />}
              title="Dating"
              description="Meet someone who shares your lifestyle."
              prefs={values.modes.dating}
              errors={errors}
              onChange={(p) => setMode('dating', p)}
            />
            {errors.modes && <p role="alert" className="text-sm text-danger">{errors.modes}</p>}
          </>
        )}

        {step === 3 && (
          <PromptsEditor
            prompts={values.prompts}
            errors={errors}
            onChange={(prompts) => set('prompts', prompts)}
          />
        )}

        {step === 4 && (
          <PhotoUploader userId={userId} photos={values.photos} error={errors.photoPaths}
            onChange={(photos) => set('photos', photos)} />
        )}

        {formError && (
          <p role="alert" className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm">{formError}</p>
        )}

        <div className="fixed inset-x-0 bottom-0 border-t bg-bg/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
          <div className="mx-auto max-w-lg">
            <Button type="submit" loading={pending} className="w-full">
              {step === STEPS.length - 1 ? 'Finish & start matching' : 'Continue'}
            </Button>
          </div>
        </div>
      </form>
    </main>
  )
}

function LocationButton({
  hasLocation,
  error,
  onLocate,
  onClearError,
}: {
  hasLocation: boolean
  error?: string
  onLocate: (lat: number, lng: number) => void
  onClearError: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied'>('idle')

  function locate() {
    if (!('geolocation' in navigator)) return setStatus('denied')
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocate(pos.coords.latitude, pos.coords.longitude)
        onClearError()
        setStatus('idle')
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    )
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={locate}
        className={cn(
          'flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left transition-colors',
          hasLocation ? 'border-accent bg-accent/10' : 'bg-surface hover:border-primary',
          error && !hasLocation && 'border-danger',
        )}
        aria-describedby={error ? 'location-error' : 'location-hint'}
      >
        {hasLocation ? <MapPin className="size-5 text-accent" aria-hidden /> : <LocateFixed className="size-5 text-primary" aria-hidden />}
        <span className="font-medium">
          {status === 'locating' ? 'Finding you…' : hasLocation ? 'Location set' : 'Use my current location'}
        </span>
      </button>
      {error && !hasLocation ? (
        <p id="location-error" role="alert" className="text-sm text-danger">{error}</p>
      ) : status === 'denied' ? (
        <p id="location-hint" className="text-sm text-danger">
          Location is blocked. Allow it in your browser settings and try again.
        </p>
      ) : (
        <p id="location-hint" className="text-sm text-muted-fg/80">
          We store it rounded to about 1 km and only ever show distance in miles.
        </p>
      )}
      {/* TODO: ZIP-code fallback via a geocoding API for users who decline location. */}
    </div>
  )
}

function ModeCard({
  mode,
  icon,
  title,
  description,
  prefs,
  errors,
  onChange,
}: {
  mode: 'buddy' | 'dating'
  icon: React.ReactNode
  title: string
  description: string
  prefs: ModePrefs
  errors: Record<string, string>
  onChange: (patch: Partial<ModePrefs>) => void
}) {
  const err = (k: string) => errors[`modes.${mode}.${k}`]
  const id = (k: string) => `${mode}-${k}`

  return (
    <section className={cn('rounded-2xl border p-5 transition-colors', prefs.enabled ? 'border-primary bg-surface' : 'bg-surface/50')}>
      <div className="flex items-start gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', prefs.enabled ? 'bg-primary text-on-primary' : 'bg-card text-muted-fg')}>
          {icon}
        </span>
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold uppercase leading-tight">{title}</h2>
          <p className="text-sm text-muted-fg">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.enabled}
          aria-label={`Turn ${title} ${prefs.enabled ? 'off' : 'on'}`}
          onClick={() => onChange({ enabled: !prefs.enabled })}
          className={cn('relative h-8 w-14 shrink-0 rounded-full transition-colors', prefs.enabled ? 'bg-primary' : 'bg-muted')}
        >
          <span className={cn('absolute top-1 size-6 rounded-full bg-white transition-all', prefs.enabled ? 'left-7' : 'left-1')} />
        </button>
      </div>

      {prefs.enabled && (
        <div className="mt-5 space-y-5">
          <Field id={id('headline')} label="Headline (optional)" error={err('headline')}>
            <Input id={id('headline')} maxLength={80} value={prefs.headline} error={err('headline')}
              placeholder={mode === 'buddy' ? 'Looking for a 6am lifting partner' : 'Sunday long runs, then brunch'}
              onChange={(e) => onChange({ headline: e.target.value })} />
          </Field>

          <fieldset>
            <legend className="mb-3 text-sm font-medium text-muted-fg">
              {mode === 'dating' ? 'Show me' : 'Buddies I’m open to (leave empty for everyone)'}
            </legend>
            <div className="flex flex-wrap gap-2">
              {GENDERS.map((g) => (
                <Chip key={g} selected={prefs.interestedIn.includes(g)}
                  onClick={() => onChange({ interestedIn: prefs.interestedIn.includes(g) ? prefs.interestedIn.filter((x) => x !== g) : [...prefs.interestedIn, g] })}>
                  {PLURAL_GENDER_LABELS[g]}
                </Chip>
              ))}
            </div>
            {err('interestedIn') && <p role="alert" className="mt-2 text-sm text-danger">{err('interestedIn')}</p>}
          </fieldset>

          <div>
            <label htmlFor={id('distance')} className="flex justify-between text-sm font-medium text-muted-fg">
              <span>Maximum distance</span>
              <span className="text-fg">{prefs.maxDistanceMi} mi</span>
            </label>
            <input id={id('distance')} type="range" min={1} max={100} value={prefs.maxDistanceMi}
              onChange={(e) => onChange({ maxDistanceMi: Number(e.target.value) })}
              className="mt-3 w-full accent-primary" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field id={id('minAge')} label="Min age" error={err('minAge')}>
              <Input id={id('minAge')} type="number" inputMode="numeric" min={18} max={99} value={prefs.minAge} error={err('minAge')}
                onChange={(e) => onChange({ minAge: Number(e.target.value) })} />
            </Field>
            <Field id={id('maxAge')} label="Max age" error={err('maxAge')}>
              <Input id={id('maxAge')} type="number" inputMode="numeric" min={18} max={99} value={prefs.maxAge} error={err('maxAge')}
                onChange={(e) => onChange({ maxAge: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
      )}
    </section>
  )
}

function PromptsEditor({
  prompts,
  errors,
  onChange,
}: {
  prompts: { key: PromptKey; answer: string }[]
  errors: Record<string, string>
  onChange: (prompts: { key: PromptKey; answer: string }[]) => void
}) {
  const used = new Set(prompts.map((p) => p.key))
  const nextFree = PROMPT_KEYS.find((k) => !used.has(k))
  const update = (i: number, patch: Partial<{ key: PromptKey; answer: string }>) =>
    onChange(prompts.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  return (
    <div className="space-y-4">
      {prompts.map((p, i) => {
        const err = errors[`prompts.${i}.answer`]
        return (
          <section key={i} className="space-y-3 rounded-2xl border bg-surface p-4">
            <div className="flex items-center gap-2">
              <label htmlFor={`prompt-${i}`} className="sr-only">Prompt {i + 1}</label>
              <Select id={`prompt-${i}`} value={p.key} onChange={(e) => update(i, { key: e.target.value as PromptKey })}>
                {PROMPT_KEYS.map((k) => (
                  <option key={k} value={k} disabled={k !== p.key && used.has(k)}>{PROMPTS[k]}</option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => onChange(prompts.filter((_, j) => j !== i))}
                aria-label={`Remove prompt ${i + 1}`}
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted-fg hover:bg-card hover:text-fg"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <Field id={`prompt-answer-${i}`} label="Your answer" error={err} hint={`${p.answer.length}/${PROMPT_ANSWER_MAX}`}>
              <Textarea
                id={`prompt-answer-${i}`}
                maxLength={PROMPT_ANSWER_MAX}
                value={p.answer}
                error={err}
                hint={`${p.answer.length}/${PROMPT_ANSWER_MAX}`}
                onChange={(e) => update(i, { answer: e.target.value })}
              />
            </Field>
          </section>
        )
      })}

      {prompts.length < MAX_PROMPTS && nextFree && (
        <Button type="button" variant="secondary" className="w-full" onClick={() => onChange([...prompts, { key: nextFree, answer: '' }])}>
          + Add a prompt ({prompts.length}/{MAX_PROMPTS})
        </Button>
      )}
      {errors.prompts && <p role="alert" className="text-sm text-danger">{errors.prompts}</p>}
    </div>
  )
}

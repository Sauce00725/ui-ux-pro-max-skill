'use client'

import { useState } from 'react'
import { Heart, LocateFixed, MapPin, ShieldCheck, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { cn } from '@/lib/utils'
import {
  BEGINNER_MAX_LEVEL,
  FITNESS_LEVELS,
  GENDERS,
  GENDER_LABELS,
  GOALS,
  GOAL_LABELS,
  MAX_GOALS,
  LOCATION_PROMPTS,
  MAX_PROMPTS,
  PROMPT_ANSWER_MAX,
  PROMPT_GROUPS,
  TRAINING_TIMES,
  TRAINING_TIME_LABELS,
  US_STATES,
  type ModePrefs,
  type PromptKey,
} from '@/lib/validation'

/*
 * Profile form sections shared by onboarding (one per step) and Settings
 * (one per card), so both always collect and validate the same fields.
 */

export type Gender = (typeof GENDERS)[number]
export type TrainingTime = (typeof TRAINING_TIMES)[number]
export type Goal = (typeof GOALS)[number]
export type PromptValue = { key: PromptKey; answer: string }

export interface BasicsValues {
  displayName: string
  birthdate: string
  gender: Gender | ''
  bio: string
  city: string
  state: string
  lat: number | null
  lng: number | null
}

export interface FitnessValues {
  activityIds: number[]
  fitnessLevel: number | null
  trainingTimes: TrainingTime[]
  goals: Goal[]
  helpsBeginners: boolean
}

export type Modes = { buddy: ModePrefs; dating: ModePrefs }

export type Setter<T> = <K extends keyof T>(key: K, value: T[K]) => void
type Errors = Record<string, string>

export const defaultMode = (enabled: boolean): ModePrefs => ({
  enabled,
  headline: '',
  minAge: 18,
  maxAge: 99,
  maxDistanceMi: 25,
  interestedIn: [],
})

export const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])

/** Only offered at level 3+; never keep a stale opt-in after the level drops. */
export const normalizeHelpsBeginners = (v: FitnessValues) =>
  v.helpsBeginners && (v.fitnessLevel ?? 0) > BEGINNER_MAX_LEVEL

const PLURAL_GENDER_LABELS: Record<Gender, string> = { woman: 'Women', man: 'Men', nonbinary: 'Nonbinary people' }

export function BasicsFields({
  values,
  errors,
  set,
  showBirthdate = true,
  onLocate,
  onClearLocationError,
}: {
  values: BasicsValues
  errors: Errors
  set: Setter<BasicsValues>
  /** Settings shows it read-only: age can't be self-edited after sign-up. */
  showBirthdate?: boolean
  onLocate: (lat: number, lng: number) => void
  onClearLocationError: () => void
}) {
  return (
    <>
      <Field id="displayName" label="First name" error={errors.displayName}>
        <Input id="displayName" autoComplete="given-name" value={values.displayName} error={errors.displayName}
          onChange={(e) => set('displayName', e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        {showBirthdate ? (
          <Field id="birthdate" label="Date of birth" error={errors.birthdate}>
            <Input id="birthdate" type="date" value={values.birthdate} error={errors.birthdate}
              onChange={(e) => set('birthdate', e.target.value)} />
          </Field>
        ) : (
          <Field id="birthdate" label="Date of birth" hint="Contact support to correct this.">
            <Input id="birthdate" type="date" value={values.birthdate} disabled readOnly hint="Contact support to correct this." />
          </Field>
        )}
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
        onLocate={onLocate}
        onClearError={onClearLocationError}
      />

      <Field id="bio" label="Bio (optional)" error={errors.bio} hint={`${values.bio.length}/500`}>
        <Textarea id="bio" maxLength={500} value={values.bio} error={errors.bio} hint={`${values.bio.length}/500`}
          placeholder="Marathon in training. Will spot you, won’t judge your playlist."
          onChange={(e) => set('bio', e.target.value)} />
      </Field>
    </>
  )
}

export function FitnessFields({
  values,
  errors,
  set,
  activities,
}: {
  values: FitnessValues
  errors: Errors
  set: Setter<FitnessValues>
  activities: { id: number; name: string }[]
}) {
  const isBeginner = values.fitnessLevel !== null && values.fitnessLevel <= BEGINNER_MAX_LEVEL
  return (
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
  )
}

export function ModesFields({
  modes,
  errors,
  onChange,
}: {
  modes: Modes
  errors: Errors
  onChange: (mode: keyof Modes, patch: Partial<ModePrefs>) => void
}) {
  return (
    <>
      <ModeCard
        mode="buddy"
        icon={<Users className="size-5" aria-hidden />}
        title="Gym Buddies"
        description="Training partners and friends. Never dating."
        prefs={modes.buddy}
        errors={errors}
        onChange={(p) => onChange('buddy', p)}
      />
      <ModeCard
        mode="dating"
        icon={<Heart className="size-5" aria-hidden />}
        title="Dating"
        description="Meet someone who shares your lifestyle."
        prefs={modes.dating}
        errors={errors}
        onChange={(p) => onChange('dating', p)}
      />
      {errors.modes && <p role="alert" className="text-sm text-danger">{errors.modes}</p>}
    </>
  )
}

export function LocationButton({
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

export function ModeCard({
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

const GROUP_KEYS = Object.keys(PROMPT_GROUPS) as (keyof typeof PROMPT_GROUPS)[]

export function PromptsEditor({
  prompts,
  errors,
  onChange,
}: {
  prompts: PromptValue[]
  errors: Errors
  onChange: (prompts: PromptValue[]) => void
}) {
  const used = new Set(prompts.map((p) => p.key))
  const update = (i: number, patch: Partial<PromptValue>) =>
    onChange(prompts.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const add = (group: keyof typeof PROMPT_GROUPS) => {
    const key = (Object.keys(PROMPT_GROUPS[group].prompts) as PromptKey[]).find((k) => !used.has(k))
    if (key) onChange([...prompts, { key, answer: '' }])
  }

  return (
    <div className="space-y-4">
      {prompts.length === 0 && (
        <p className="text-sm text-muted-fg">Tip: mix one personal prompt with a gym or training one.</p>
      )}

      {prompts.map((p, i) => {
        const err = errors[`prompts.${i}.answer`]
        return (
          <section key={i} className="space-y-3 rounded-2xl border bg-surface p-4">
            <div className="flex items-center gap-2">
              <label htmlFor={`prompt-${i}`} className="sr-only">Prompt {i + 1}</label>
              <Select id={`prompt-${i}`} value={p.key} onChange={(e) => update(i, { key: e.target.value as PromptKey })}>
                {GROUP_KEYS.map((g) => (
                  <optgroup key={g} label={PROMPT_GROUPS[g].label}>
                    {(Object.entries(PROMPT_GROUPS[g].prompts) as [PromptKey, string][]).map(([k, label]) => (
                      <option key={k} value={k} disabled={k !== p.key && used.has(k)}>{label}</option>
                    ))}
                  </optgroup>
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
            {LOCATION_PROMPTS.includes(p.key) && (
              <p className="flex gap-2 rounded-panel border border-[color:var(--glass-stroke)] bg-[color:var(--glass-fill)] p-2.5 text-xs text-muted-fg">
                <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
                This tells people where you’ll be. Naming the gym chain or neighborhood, not the exact location or
                your usual hours, is safer until you’ve met.
              </p>
            )}
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

      {prompts.length < MAX_PROMPTS && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted-fg">
            Add a prompt ({prompts.length}/{MAX_PROMPTS})
          </p>
          <div className="grid grid-cols-3 gap-2">
            {GROUP_KEYS.map((g) => (
              <Button key={g} type="button" variant="secondary" className="h-auto min-h-12 px-2 py-2 text-sm leading-tight"
                onClick={() => add(g)}>
                + {PROMPT_GROUPS[g].label}
              </Button>
            ))}
          </div>
        </div>
      )}
      {errors.prompts && <p role="alert" className="text-sm text-danger">{errors.prompts}</p>}
    </div>
  )
}

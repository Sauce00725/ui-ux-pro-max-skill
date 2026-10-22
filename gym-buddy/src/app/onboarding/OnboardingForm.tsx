'use client'

import { useState, useTransition } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { PhotoUploader, type UploadedPhoto } from '@/components/PhotoUploader'
import {
  BasicsFields,
  FitnessFields,
  ModesFields,
  PromptsEditor,
  defaultMode,
  normalizeHelpsBeginners,
  type BasicsValues,
  type FitnessValues,
  type Modes,
  type PromptValue,
  type Setter,
} from '@/components/profile/ProfileFields'
import {
  basicsSchema,
  fitnessSchema,
  modesSchema,
  photosSchema,
  promptsSchema,
  toFieldErrors,
  type ModePrefs,
} from '@/lib/validation'
import { completeOnboarding } from './actions'

interface Values extends BasicsValues, FitnessValues {
  modes: Modes
  prompts: PromptValue[]
  photos: UploadedPhoto[]
}

const STEPS = [
  { title: 'The basics', subtitle: 'Only your first name, age and city are public.', schema: basicsSchema, keys: ['displayName', 'birthdate', 'gender', 'bio', 'city', 'state', 'lat', 'lng'] },
  { title: 'How you move', subtitle: 'Already training or just getting started, we match you on activities, goals and schedules.', schema: fitnessSchema, keys: ['activityIds', 'fitnessLevel', 'trainingTimes', 'goals', 'helpsBeginners'] },
  { title: 'What you’re here for', subtitle: 'Dating and Training Partners are separate. Nobody sees a mode you haven’t turned on.', schema: modesSchema, keys: ['modes'] },
  { title: 'Add prompts', subtitle: 'Optional, but prompts give people something to like and an easy first message.', schema: promptsSchema, keys: ['prompts'] },
  { title: 'Add photos', subtitle: 'Clear, recent photos get far more matches. Training shots welcome.', schema: photosSchema, keys: ['photoPaths'] },
] as const

const toPayload = ({ photos, ...rest }: Values) => ({
  ...rest,
  helpsBeginners: normalizeHelpsBeginners(rest),
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
  const setMode = (mode: keyof Modes, patch: Partial<ModePrefs>) =>
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

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-32 pt-6">
      <Logo size="sm" className="mb-6" />

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

      <h1 className="mt-8 font-display text-3xl font-bold uppercase leading-none">{current.title}</h1>
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
          <BasicsFields
            values={values}
            errors={errors}
            // Values is a superset of BasicsValues, so its setter covers these keys.
            set={set as Setter<BasicsValues>}
            onLocate={(lat, lng) => setValues((v) => ({ ...v, lat, lng }))}
            onClearLocationError={() => setErrors(({ lat: _lat, lng: _lng, ...rest }) => rest)}
          />
        )}

        {step === 1 && (
          <FitnessFields values={values} errors={errors} set={set as Setter<FitnessValues>} activities={activities} />
        )}

        {step === 2 && <ModesFields modes={values.modes} errors={errors} onChange={setMode} />}

        {step === 3 && (
          <PromptsEditor prompts={values.prompts} errors={errors} onChange={(prompts) => set('prompts', prompts)} />
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

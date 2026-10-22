'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, LogOut, PauseCircle, PlayCircle, Trash2 } from 'lucide-react'
import { signOut } from '@/app/(auth)/actions'
import { saveBasics, saveFitness, saveModes, savePhotos, savePrompts, setPaused } from '@/app/(app)/settings/actions'
import { Logo } from '@/components/Logo'
import { PhotoUploader, type UploadedPhoto } from '@/components/PhotoUploader'
import {
  BasicsFields,
  FitnessFields,
  ModesFields,
  PromptsEditor,
  normalizeHelpsBeginners,
  type BasicsValues,
  type FitnessValues,
  type Modes,
  type PromptValue,
} from '@/components/profile/ProfileFields'
import { Button } from '@/components/ui/Button'
import { TranslationPreference } from './TranslationPreference'
import { createClient } from '@/lib/supabase/client'
import type { ActionResult } from '@/lib/types'
import { fitnessSchema, modesSchema, photosSchema, promptsSchema, settingsBasicsSchema, toFieldErrors } from '@/lib/validation'
import type { z } from 'zod'

interface Initial {
  basics: BasicsValues
  fitness: FitnessValues
  modes: Modes
  prompts: PromptValue[]
  photos: UploadedPhoto[]
}

/**
 * Settings = the onboarding sections again, each in its own card with its own
 * Save, so a change to prompts never risks clobbering photos (and vice versa).
 */
export function SettingsForm({
  userId,
  email,
  activities,
  paused,
  pendingPhotos,
  initial,
}: {
  userId: string
  email: string
  activities: { id: number; name: string }[]
  paused: boolean
  pendingPhotos: number
  initial: Initial
}) {
  const basics = useSection(initial.basics, settingsBasicsSchema, (v) => v, saveBasics)
  const fitness = useSection(initial.fitness, fitnessSchema, (v) => ({ ...v, helpsBeginners: normalizeHelpsBeginners(v) }), saveFitness)
  const modes = useSection({ modes: initial.modes }, modesSchema, (v) => v, saveModes)
  const prompts = useSection({ prompts: initial.prompts }, promptsSchema, (v) => v, savePrompts)
  const photos = useSection({ photos: initial.photos }, photosSchema, (v) => ({ photoPaths: v.photos.map((p) => p.path) }), savePhotos)

  return (
    <main className="mx-auto max-w-md space-y-5 px-(--space-gutter) pb-10 pt-3">
      <div>
        <p className="hud-label text-primary">// Profile</p>
        <h1 className="font-display text-title font-bold uppercase [text-shadow:0_0_16px_rgb(34_230_255/0.4)]">Settings</h1>
        <p className="mt-1 text-sm text-muted-fg">Changes save per section. Photos you add are reviewed before others see them.</p>
      </div>

      <Section title="Photos" eyebrow="01" state={photos}>
        <PhotoUploader
          userId={userId}
          photos={photos.values.photos}
          error={photos.errors.photoPaths}
          deleteOnRemove={false}
          onChange={(p) => photos.set('photos', p)}
        />
        {pendingPhotos > 0 && <p className="text-sm text-[color:var(--color-super)]">{pendingPhotos} photo(s) waiting for review.</p>}
      </Section>

      <Section title="Basics" eyebrow="02" state={basics}>
        <BasicsFields
          values={basics.values}
          errors={basics.errors}
          set={basics.set}
          showBirthdate={false}
          onLocate={(lat, lng) => basics.patch({ lat, lng })}
          onClearLocationError={() => {}}
        />
      </Section>

      <Section title="Fitness & goals" eyebrow="03" state={fitness}>
        <FitnessFields values={fitness.values} errors={fitness.errors} set={fitness.set} activities={activities} />
      </Section>

      <Section title="Prompts" eyebrow="04" state={prompts}>
        <PromptsEditor prompts={prompts.values.prompts} errors={prompts.errors} onChange={(p) => prompts.set('prompts', p)} />
      </Section>

      <Section title="Dating & Training Partners" eyebrow="05" state={modes}>
        <ModesFields
          modes={modes.values.modes}
          errors={modes.errors}
          onChange={(mode, patch) => modes.set('modes', { ...modes.values.modes, [mode]: { ...modes.values.modes[mode], ...patch } })}
        />
      </Section>

      <TranslationPreference />

      <AccountSection userId={userId} email={email} paused={paused} />

      <div className="flex justify-center pt-4 opacity-70">
        <Logo size="sm" />
      </div>
    </main>
  )
}

/* ─── Section state: values, errors, dirty, save ──────────────────────────── */

function useSection<T extends object, S extends z.ZodTypeAny>(
  initial: T,
  schema: S,
  toPayload: (v: T) => unknown,
  action: (input: unknown) => Promise<ActionResult>,
) {
  const [values, setValues] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<{ kind: 'idle' | 'saved' | 'error'; message?: string }>({ kind: 'idle' })
  const [pending, startTransition] = useTransition()
  const dirty = JSON.stringify(values) !== JSON.stringify(saved)

  const patch = (p: Partial<T>) => {
    setValues((v) => ({ ...v, ...p }))
    setStatus({ kind: 'idle' })
  }
  const set = <K extends keyof T>(key: K, value: T[K]) => {
    patch({ [key]: value } as unknown as Partial<T>)
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key && !k.startsWith(`${String(key)}.`))))
  }

  const save = () => {
    const payload = toPayload(values)
    const check = schema.safeParse(payload)
    if (!check.success) {
      setErrors(toFieldErrors(check.error))
      setStatus({ kind: 'error', message: 'Fix the highlighted fields.' })
      return
    }
    startTransition(async () => {
      const res = await action(payload)
      if (res.ok) {
        setSaved(values)
        setErrors({})
        setStatus({ kind: 'saved' })
      } else {
        setErrors(res.fieldErrors ?? {})
        setStatus({ kind: 'error', message: res.message })
      }
    })
  }
  const reset = () => {
    setValues(saved)
    setErrors({})
    setStatus({ kind: 'idle' })
  }

  return { values, errors, set, patch, save, reset, dirty, pending, status }
}

type SectionState = Pick<ReturnType<typeof useSection>, 'save' | 'reset' | 'dirty' | 'pending' | 'status'>

function Section({ title, eyebrow, state, children }: { title: string; eyebrow: string; state: SectionState; children: React.ReactNode }) {
  return (
    <section className="glass glass-flat relative space-y-5 rounded-card p-(--space-card)" aria-labelledby={`s-${eyebrow}`}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 id={`s-${eyebrow}`} className="font-display text-lg font-bold uppercase">{title}</h2>
        <span className="hud-label">{eyebrow}</span>
      </header>
      {children}
      <footer className="flex items-center justify-end gap-3 border-t border-[color:var(--glass-stroke)] pt-4">
        <p className="mr-auto text-sm" role="status" aria-live="polite">
          {state.status.kind === 'saved' && !state.dirty && (
            <span className="flex items-center gap-1 text-accent"><Check className="size-4" aria-hidden /> Saved</span>
          )}
          {state.status.kind === 'error' && <span className="text-danger">{state.status.message}</span>}
        </p>
        {state.dirty && <Button type="button" variant="ghost" className="h-10" onClick={state.reset}>Undo</Button>}
        <Button type="button" className="h-10" disabled={!state.dirty} loading={state.pending} onClick={state.save}>
          Save
        </Button>
      </footer>
    </section>
  )
}

/* ─── Account ─────────────────────────────────────────────────────────────── */

function AccountSection({ userId, email, paused: initialPaused }: { userId: string; email: string; paused: boolean }) {
  const [paused, setPausedState] = useState(initialPaused)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const [confirming, setConfirming] = useState(false)

  const togglePause = () =>
    startTransition(async () => {
      const res = await setPaused(!paused)
      if (res.ok) setPausedState(!paused)
      else setError(res.message)
    })

  return (
    <section className="glass glass-flat relative space-y-4 rounded-card p-(--space-card)" aria-labelledby="s-account">
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="s-account" className="font-display text-lg font-bold uppercase">Account</h2>
        <span className="hud-label">07</span>
      </header>
      <p className="hud-label normal-case tracking-normal">{email}</p>

      <div className="flex items-start gap-3 rounded-panel border border-[color:var(--glass-stroke)] bg-[color:var(--glass-fill)] p-3">
        <div className="flex-1 text-sm">
          <p className="font-semibold">{paused ? 'Profile paused' : 'Pause my profile'}</p>
          <p className="text-muted-fg">
            {paused ? 'You’re hidden from Dating and Training Partners. Chats and events still work.' : 'Hide from everyone’s deck without deleting anything.'}
          </p>
        </div>
        <Button type="button" variant="secondary" className="h-10 shrink-0" loading={pending} onClick={togglePause}>
          {paused ? <><PlayCircle className="size-4" aria-hidden /> Resume</> : <><PauseCircle className="size-4" aria-hidden /> Pause</>}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <form action={signOut}>
          <Button type="submit" variant="secondary" className="h-10"><LogOut className="size-4" aria-hidden /> Sign out</Button>
        </form>
        <Button type="button" variant="ghost" className="h-10 text-danger hover:text-danger" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" aria-hidden /> Delete account
        </Button>
      </div>

      {confirming && <DeleteAccountDialog userId={userId} onClose={() => setConfirming(false)} />}
    </section>
  )
}

function DeleteAccountDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const destroy = () =>
    startTransition(async () => {
      const supabase = createClient()
      // Storage files aren't removed by the database cascade, so delete them first.
      const { data: files } = await supabase.storage.from('photos').list(userId, { limit: 100 })
      if (files?.length) await supabase.storage.from('photos').remove(files.map((f) => `${userId}/${f.name}`))
      const { error } = await supabase.rpc('delete_my_account')
      if (error) return setError('Couldn’t delete your account. Try again or contact support.')
      await supabase.auth.signOut()
      router.replace('/')
    })

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="del-title"
      className="glass-strong m-auto w-[calc(100%-2rem)] max-w-sm rounded-card p-6 text-fg backdrop:bg-black/70">
      <h2 id="del-title" className="font-display text-xl font-bold uppercase text-danger">Delete account?</h2>
      <p className="mt-2 text-sm text-muted-fg">
        This permanently deletes your profile, photos, matches, messages and RSVPs. It can’t be undone. To just take a
        break, pause your profile instead.
      </p>
      <label htmlFor="confirm-delete" className="mt-4 block text-sm font-medium">Type DELETE to confirm</label>
      <input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off"
        className="mt-1.5 w-full rounded-panel border bg-surface px-4 py-3 font-mono focus:border-danger focus:outline-none" />
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => ref.current?.close()}>Cancel</Button>
        <Button variant="danger" disabled={typed !== 'DELETE'} loading={pending} onClick={destroy}>Delete forever</Button>
      </div>
    </dialog>
  )
}

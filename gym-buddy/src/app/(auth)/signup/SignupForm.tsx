'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { signUp, type AuthFormState } from '../actions'

const maxBirthdate = (() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().slice(0, 10)
})()

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {})
  const e = state.fieldErrors ?? {}

  if (state.checkEmail) {
    return (
      <div role="status" className="rounded-2xl border bg-surface p-6 text-center">
        <MailCheck className="mx-auto size-10 text-accent" aria-hidden />
        <h2 className="mt-3 text-xl font-semibold">Check your email</h2>
        <p className="mt-2 text-muted-fg">
          We sent a confirmation link to <strong className="text-fg">{state.values?.email}</strong>. Open it on this
          device to set up your profile.
        </p>
      </div>
    )
  }

  return (
    <form action={action} noValidate className="space-y-5">
      {state.message && (
        <p role="alert" className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm">
          {state.message}
        </p>
      )}

      <Field id="email" label="Email" error={e.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required
          defaultValue={state.values?.email} error={e.email} />
      </Field>

      <Field id="password" label="Password" error={e.password} hint="8+ characters with a letter and a number">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8}
          error={e.password} hint="8+ characters with a letter and a number" />
      </Field>

      <Field id="confirmPassword" label="Confirm password" error={e.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required
          error={e.confirmPassword} />
      </Field>

      <Field id="birthdate" label="Date of birth" error={e.birthdate} hint="You must be 18+. Only your age is shown.">
        <Input id="birthdate" name="birthdate" type="date" required max={maxBirthdate}
          defaultValue={state.values?.birthdate} error={e.birthdate} hint="You must be 18+. Only your age is shown." />
      </Field>

      <div className="space-y-1.5">
        <label className="flex items-start gap-3 text-sm text-muted-fg">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 size-5 accent-primary"
            aria-invalid={!!e.acceptTerms} aria-describedby={e.acceptTerms ? 'acceptTerms-error' : undefined} />
          <span>
            I agree to the <Link href="/terms" className="text-primary underline">Terms</Link>,{' '}
            <Link href="/privacy" className="text-primary underline">Privacy Policy</Link> and{' '}
            <Link href="/guidelines" className="text-primary underline">Community Guidelines</Link>.
          </span>
        </label>
        {e.acceptTerms && <p id="acceptTerms-error" role="alert" className="text-sm text-danger">{e.acceptTerms}</p>}
      </div>

      <Button type="submit" loading={pending} className="w-full">Create account</Button>

      <p className="text-center text-sm text-muted-fg">
        Already a member? <Link href="/login" className="font-semibold text-primary">Log in</Link>
      </p>
    </form>
  )
}

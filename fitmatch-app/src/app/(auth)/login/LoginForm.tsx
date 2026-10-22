'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { signIn, type AuthFormState } from '../actions'

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signIn, {})
  const e = state.fieldErrors ?? {}

  return (
    <form action={action} noValidate className="space-y-5">
      {state.message && (
        <p role="alert" className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm">
          {state.message}
        </p>
      )}
      <input type="hidden" name="next" value={next ?? ''} />

      <Field id="email" label="Email" error={e.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required
          defaultValue={state.values?.email} error={e.email} />
      </Field>
      <Field id="password" label="Password" error={e.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required
          error={e.password} />
      </Field>

      <Button type="submit" loading={pending} className="w-full">Log in</Button>

      <p className="text-center text-sm text-muted-fg">
        New here? <Link href="/signup" className="font-semibold text-primary">Create an account</Link>
      </p>
    </form>
  )
}

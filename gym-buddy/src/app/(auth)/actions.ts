'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loginSchema, signupSchema, toFieldErrors } from '@/lib/validation'
import { safeNext } from '@/lib/utils'

export type AuthFormState = {
  message?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
  checkEmail?: boolean
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>
  // Echo back non-secret values so the form keeps them after a failed submit.
  const values = { email: raw.email ?? '', birthdate: raw.birthdate ?? '' }

  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/onboarding`,
      // Carried into onboarding so the user doesn't re-enter it.
      data: { birthdate: parsed.data.birthdate },
    },
  })

  if (error) {
    // Don't reveal whether an email is already registered.
    return { message: error.status === 429 ? 'Too many attempts. Try again in a minute.' : 'Could not create your account. Please try again.', values }
  }

  // Email confirmation disabled → we already have a session.
  if (data.session) redirect('/onboarding')
  return { checkEmail: true, values }
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>
  const values = { email: raw.email ?? '' }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { message: 'Email or password is incorrect.', values }

  redirect(safeNext(raw.next))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

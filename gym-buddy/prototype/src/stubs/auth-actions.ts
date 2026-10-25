import { bus } from '../bus'

export type AuthFormState = {
  message?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
  checkEmail?: boolean
}

// There is no account to make: signing up or in just opens the app.
async function enter(): Promise<AuthFormState> {
  await new Promise((r) => setTimeout(r, 650))
  bus.navigate('/discover?mode=dating', { replace: true })
  return {}
}
export const signUp = (_prev: AuthFormState, _form: FormData) => enter()
export const signIn = (_prev: AuthFormState, _form: FormData) => enter()
export async function signOut() {
  bus.navigate('/', { replace: true })
}

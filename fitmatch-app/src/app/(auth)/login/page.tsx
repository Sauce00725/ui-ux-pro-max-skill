import { AuthShell } from '../AuthShell'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Log in · FitMatch' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <AuthShell title="Welcome back" subtitle="Your matches, buddies and events are waiting.">
      <LoginForm next={next} />
    </AuthShell>
  )
}

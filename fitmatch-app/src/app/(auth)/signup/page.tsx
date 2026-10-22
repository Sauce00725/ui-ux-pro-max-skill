import { AuthShell } from '../AuthShell'
import { SignupForm } from './SignupForm'

export const metadata = { title: 'Join · FitMatch' }

export default function SignupPage() {
  return (
    <AuthShell title="Find your people" subtitle="Dates, gym buddies and local events, from day one to race day.">
      <SignupForm />
    </AuthShell>
  )
}

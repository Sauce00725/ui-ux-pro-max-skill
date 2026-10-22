import { AuthShell } from '../AuthShell'
import { SignupForm } from './SignupForm'

export const metadata = { title: 'Join' }

export default function SignupPage() {
  return (
    <AuthShell title="Find your people" subtitle="Dates, training partners and local events, from day one to race day.">
      <SignupForm />
    </AuthShell>
  )
}

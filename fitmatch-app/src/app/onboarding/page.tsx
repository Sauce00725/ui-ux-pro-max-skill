import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from './OnboardingForm'

export const metadata = { title: 'Set up your profile · FitMatch' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/onboarding')

  const [{ data: modes }, { data: activities }] = await Promise.all([
    supabase.from('profile_modes').select('mode').eq('user_id', user.id).limit(1),
    supabase.from('activities').select('id, name').order('name'),
  ])
  if (modes?.length) redirect('/discover')

  return (
    <OnboardingForm
      userId={user.id}
      activities={activities ?? []}
      defaultBirthdate={typeof user.user_metadata?.birthdate === 'string' ? user.user_metadata.birthdate : ''}
    />
  )
}

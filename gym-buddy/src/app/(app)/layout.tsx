import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { olderThan } from '@/lib/utils'
import { BottomNav } from '@/components/BottomNav'
import { TopBar } from '@/components/TopBar'

const ACTIVE_PING_MS = 60 * 60 * 1000

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('last_active_at, status, profile_modes(mode)')
    .eq('id', user.id)
    .maybeSingle()

  // profile_modes is written last in onboarding, so it marks completion.
  if (!profile || profile.profile_modes.length === 0) redirect('/onboarding')
  if (profile.status === 'banned') redirect('/login?error=account_suspended')

  // Feeds rank recently active people higher; refresh at most hourly.
  if (olderThan(profile.last_active_at, ACTIVE_PING_MS)) {
    await supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', user.id)
  }

  return (
    <div className="min-h-dvh pb-(--dock-clearance)">
      <TopBar />
      {children}
      <Suspense>
        <BottomNav />
      </Suspense>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { Landing } from '@/components/landing/Landing'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/discover')

  return <Landing />
}

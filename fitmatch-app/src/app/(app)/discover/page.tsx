import { createClient } from '@/lib/supabase/server'
import { getSelection } from '@/lib/discovery'
import type { AppMode } from '@/lib/types'
import { DailyDeck } from '@/components/deck/DailyDeck'
import { EnableModePrompt } from './EnableModePrompt'

export const metadata = { title: 'Discover · FitMatch' }

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode: raw } = await searchParams
  const mode: AppMode = raw === 'dating' ? 'dating' : 'buddy'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: modeRow } = await supabase
    .from('profile_modes')
    .select('is_active')
    .eq('user_id', user!.id)
    .eq('mode', mode)
    .maybeSingle()

  if (!modeRow?.is_active) return <EnableModePrompt mode={mode} />

  const { cards, quota, superQuota } = await getSelection(supabase, mode)
  // key resets the deck's state when switching modes.
  return <DailyDeck key={mode} mode={mode} initialCards={cards} initialQuota={quota} initialSuperQuota={superQuota} />
}

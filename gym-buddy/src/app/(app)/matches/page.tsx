import { createClient } from '@/lib/supabase/server'
import { signPhotoUrls } from '@/lib/discovery'
import { MatchesView } from '@/components/matches/MatchesView'

export const metadata = { title: 'Chats' }

const PROFILE_COLS = 'id, display_name'

export default async function MatchesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const me = user!.id

  const { data: matches } = await supabase
    .from('matches')
    .select(`id, mode, created_at, last_message_at,
             a:profiles!matches_user_a_fkey(${PROFILE_COLS}),
             b:profiles!matches_user_b_fkey(${PROFILE_COLS})`)
    .is('unmatched_at', null)
    .order('last_message_at', { ascending: false, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = (matches ?? []).map((m) => {
    const a = m.a as unknown as { id: string; display_name: string }
    const b = m.b as unknown as { id: string; display_name: string }
    return { ...m, other: a.id === me ? b : a }
  })

  // Main photo per person, signed for the avatar.
  const { data: photos } = await supabase
    .from('photos')
    .select('user_id, storage_path')
    .in('user_id', rows.map((r) => r.other.id))
    .eq('moderation', 'approved')
    .eq('position', 0)
  const urls = await signPhotoUrls(supabase, (photos ?? []).map((p) => p.storage_path))
  const avatars = Object.fromEntries((photos ?? []).map((p) => [p.user_id, urls.get(p.storage_path)]))

  return <MatchesView rows={rows} avatars={avatars} />
}

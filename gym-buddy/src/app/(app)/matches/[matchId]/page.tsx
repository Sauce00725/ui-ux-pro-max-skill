import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signPhotoUrls } from '@/lib/discovery'
import { ChatWindow } from '@/components/chat/ChatWindow'
import type { AppMode } from '@/lib/types'

const PAGE_SIZE = 40

export default async function ChatPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const me = user!.id

  // RLS returns the match only to its two participants.
  const { data: match } = await supabase
    .from('matches')
    .select('id, mode, user_a, user_b, unmatched_at')
    .eq('id', matchId)
    .maybeSingle()
  if (!match) notFound()
  if (match.unmatched_at) redirect('/matches')

  const otherId = match.user_a === me ? match.user_b : match.user_a

  const [{ data: other }, { data: photo }, { data: recent }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', otherId).single(),
    supabase.from('photos').select('storage_path').eq('user_id', otherId).eq('moderation', 'approved')
      .order('position').limit(1).maybeSingle(),
    supabase.from('messages').select('id, client_id, match_id, sender_id, body, created_at, read_at, kind, context')
      .eq('match_id', matchId).order('created_at', { ascending: false }).limit(PAGE_SIZE),
  ])

  // Photos referenced by "liked your photo" openers, shown as thumbnails.
  const likedPhotoIds = [
    ...new Set((recent ?? []).map((m) => (m.context as { photo_id?: string } | null)?.photo_id).filter((id): id is string => !!id)),
  ]
  const { data: likedPhotos } = likedPhotoIds.length
    ? await supabase.from('photos').select('id, storage_path').in('id', likedPhotoIds)
    : { data: [] as { id: string; storage_path: string }[] }

  const urls = await signPhotoUrls(supabase, [
    ...(photo ? [photo.storage_path] : []),
    ...(likedPhotos ?? []).map((p) => p.storage_path),
  ])
  const contextPhotos = Object.fromEntries(
    (likedPhotos ?? []).flatMap((p) => (urls.get(p.storage_path) ? [[p.id, urls.get(p.storage_path)!]] : [])),
  )

  return (
    <ChatWindow
      matchId={match.id}
      mode={match.mode as AppMode}
      currentUserId={me}
      other={{ name: other?.display_name ?? 'Member', avatarUrl: photo ? urls.get(photo.storage_path) : undefined }}
      initialMessages={(recent ?? []).reverse()}
      initialHasMore={(recent?.length ?? 0) === PAGE_SIZE}
      contextPhotos={contextPhotos}
    />
  )
}

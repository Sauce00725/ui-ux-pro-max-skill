import { createClient } from '@/lib/supabase/server'
import { getLikesReceived } from '@/lib/discovery'
import { LikesView } from '@/components/likes/LikesView'
import type { AppMode } from '@/lib/types'

export const metadata = { title: 'Likes' }

export default async function LikesPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode: raw } = await searchParams
  const mode: AppMode = raw === 'buddy' ? 'buddy' : 'dating'

  const supabase = await createClient()
  const likes = await getLikesReceived(supabase, mode)

  return <LikesView mode={mode} likes={likes} />
}

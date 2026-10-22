'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Handshake, Heart, MessageCircleHeart, Star, X } from 'lucide-react'
import { swipe } from '@/app/(app)/discover/actions'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/Button'
import { ProfileCard } from '@/components/deck/ProfileCard'
import { PROMPTS } from '@/lib/validation'
import type { AppMode, LikeReceived } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Hinge-style inbox: who liked you, what they liked, what they said. */
export function LikesInbox({ mode, initialLikes }: { mode: AppMode; initialLikes: LikeReceived[] }) {
  const [likes, setLikes] = useState(initialLikes)
  const [open, setOpen] = useState<LikeReceived | null>(null)

  if (likes.length === 0) {
    return (
      <section className="glass hud-frame relative mt-6 rounded-card p-(--space-card) text-center">
        <MessageCircleHeart className="mx-auto size-8 text-primary" aria-hidden />
        <h2 className="mt-3 font-display text-lg font-bold uppercase">No likes yet</h2>
        <p className="mt-1 text-sm text-muted-fg">
          When someone likes your photo or prompt, it shows up here, even before you’ve seen them.
        </p>
      </section>
    )
  }

  return (
    <>
      <ul className="mt-5 space-y-3 pb-6">
        {likes.map((like) => (
          <li key={like.id}>
            <button
              type="button"
              onClick={() => setOpen(like)}
              className={cn(
                'glass relative flex w-full items-start gap-3 rounded-panel p-3 text-left shadow-none transition-colors hover:bg-white/5',
                like.isSuper && 'border-[color:var(--color-super)]/60 shadow-[0_0_24px_-10px_var(--color-super)]',
              )}
            >
              <Avatar url={like.photos[0]} name={like.name} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate font-display font-bold uppercase">{like.name}</span>
                  <span className="font-mono text-sm text-primary">{like.age}</span>
                  {like.isSuper && (
                    <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-super)]">
                      <Star className="size-3" fill="currentColor" aria-hidden /> Super
                    </span>
                  )}
                </p>
                <p className="hud-label mt-0.5">{likedWhat(like)}</p>
                {like.comment && (
                  <p className="mt-2 rounded-2xl rounded-tl-md bg-card px-3 py-2 text-sm leading-snug">“{like.comment}”</p>
                )}
              </div>
              <LikedThumb like={like} />
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <ReviewDialog
          mode={mode}
          like={open}
          onClose={() => setOpen(null)}
          onDone={(id) => setLikes((l) => l.filter((x) => x.id !== id))}
        />
      )}
    </>
  )
}

function likedWhat(like: LikeReceived) {
  const verb = like.isSuper ? 'Super liked' : 'Liked'
  if (like.likedPhotoUrl) return `${verb} your photo`
  if (like.likedPrompt) return `${verb} your prompt`
  return `${verb} you`
}

function LikedThumb({ like }: { like: LikeReceived }) {
  if (like.likedPhotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={like.likedPhotoUrl} alt="Your liked photo" className="h-16 w-12 shrink-0 rounded-chip object-cover" />
  }
  return null
}

function ReviewDialog({
  mode,
  like,
  onClose,
  onDone,
}: {
  mode: AppMode
  like: LikeReceived
  onClose: () => void
  onDone: (id: string) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const LikeIcon = mode === 'dating' ? Heart : Handshake

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const respond = (action: 'like' | 'pass') =>
    startTransition(async () => {
      const res = await swipe({ targetId: like.id, mode, action })
      if (!res.ok) return setError(res.message)
      onDone(like.id)
      if (res.matchId) router.push(`/matches/${res.matchId}`)
      else ref.current?.close()
    })

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={`${like.name} liked you`}
      className="m-auto h-[min(92dvh,760px)] w-[calc(100%-1.5rem)] max-w-md overflow-hidden bg-transparent p-0 text-fg backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex h-full flex-col gap-3">
        {/* What they sent */}
        <div className={cn('glass-strong rounded-panel p-3', like.isSuper && 'border-[color:var(--color-super)]/60')}>
          <p className={cn('hud-label flex items-center gap-1.5', like.isSuper && 'text-[color:var(--color-super)]')}>
            {like.isSuper ? <Star className="size-3.5" fill="currentColor" aria-hidden /> : <MessageCircleHeart className="size-3.5 text-primary" aria-hidden />}
            {likedWhat(like)}
          </p>
          {like.likedPrompt && (
            <p className="mt-1 text-sm text-muted-fg">
              {PROMPTS[like.likedPrompt.key as keyof typeof PROMPTS] ?? like.likedPrompt.key}: <span className="text-fg">{like.likedPrompt.answer}</span>
            </p>
          )}
          {like.comment && <p className="mt-2 text-fg">“{like.comment}”</p>}
        </div>

        <div className="deck-stage relative min-h-0 flex-1">
          <ProfileCard card={like} depth={0} mode={mode} />
        </div>

        {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}

        <div className="grid grid-cols-[auto_1fr_1fr] gap-3">
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close"
            className="glass grid size-12 place-items-center rounded-panel shadow-none hover:bg-white/10">
            <X className="size-5" aria-hidden />
          </button>
          <Button variant="secondary" loading={pending} onClick={() => respond('pass')}>Pass</Button>
          <Button loading={pending} onClick={() => respond('like')}>
            <LikeIcon className="size-4" fill={mode === 'dating' ? 'currentColor' : 'none'} aria-hidden />
            Like back
          </Button>
        </div>
      </div>
    </dialog>
  )
}

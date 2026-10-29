'use client'

import { useEffect, useRef, useState } from 'react'
import { Heart, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LIKE_COMMENT_MAX, PROMPTS } from '@/lib/validation'
import type { AppMode, DiscoveryCard, LikeTarget, SuperQuota } from '@/lib/types'
import { formatRemaining, useCountdown } from './useCountdown'

/**
 * Hinge-style: like a specific photo or prompt and (optionally) say something.
 * They see it in their Likes tab before any match; if they like back, the
 * comment becomes the first message in the chat.
 */
export function LikeComposer({
  mode,
  card,
  target,
  superQuota,
  onSend,
  onClose,
}: {
  mode: AppMode
  card: DiscoveryCard
  target: LikeTarget
  superQuota: SuperQuota
  onSend: (input: { comment: string; super: boolean }) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const [comment, setComment] = useState('')
  const superMs = useCountdown(superQuota.remaining > 0 ? null : superQuota.resetsAt)
  const canSuper = superQuota.remaining > 0

  useEffect(() => {
    ref.current?.showModal()
    commentRef.current?.focus() // start where people type, not on the close button
  }, [])

  const send = (asSuper: boolean) => {
    onSend({ comment: comment.trim(), super: asSuper })
    ref.current?.close()
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="composer-title"
      className="glass-strong mx-auto mb-0 mt-auto w-full max-w-md rounded-t-card rounded-b-none p-(--space-card) pb-[max(var(--space-card),env(safe-area-inset-bottom))] text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:m-auto sm:rounded-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="hud-label text-primary">// {target.kind === 'photo' ? 'Photo' : 'Prompt'} like</p>
          <h2 id="composer-title" className="mt-1 font-display text-title font-bold uppercase">
            Like {card.name}’s {target.kind}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* What you're replying to */}
      <div className="mt-4">
        {target.kind === 'photo' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={target.url} alt="" className="h-40 w-full rounded-panel object-cover" />
        ) : (
          <div className="rounded-panel border border-[color:var(--glass-stroke)] bg-[color:var(--glass-fill)] p-4">
            <p className="hud-label">{PROMPTS[target.key as keyof typeof PROMPTS] ?? target.key}</p>
            <p className="mt-1 font-display text-lg font-medium leading-snug">{target.answer}</p>
          </div>
        )}
      </div>

      <label htmlFor="like-comment" className="mt-5 block text-sm font-medium text-muted-fg">
        Add a comment <span className="text-muted-fg/70">(optional, but it gets more replies)</span>
      </label>
      <textarea
        id="like-comment"
        ref={commentRef}
        value={comment}
        maxLength={LIKE_COMMENT_MAX}
        rows={3}
        onChange={(e) => setComment(e.target.value)}
        placeholder={target.kind === 'prompt' ? 'Respond to their answer…' : 'Say something about this photo…'}
        className="mt-1.5 w-full resize-none rounded-panel border bg-surface px-4 py-3 text-base focus:border-primary focus:outline-none"
      />
      <p className="mt-1 text-right font-mono text-xs text-muted-fg">
        {comment.length}/{LIKE_COMMENT_MAX}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={!canSuper}
          onClick={() => send(true)}
          className="border-[color:var(--color-super)]/60 text-[color:var(--color-super)]"
          aria-describedby="super-hint"
        >
          <Star className="size-4" fill={canSuper ? 'currentColor' : 'none'} aria-hidden /> Super Like
        </Button>
        <Button type="button" onClick={() => send(false)}>
          <Heart className="size-4" fill="currentColor" aria-hidden /> Send like
        </Button>
      </div>
      <p id="super-hint" className="mt-2 text-center text-xs text-muted-fg">
        {canSuper
          ? `Super Like = really interested. 1 per day, and you’ll be at the top of their ${mode === 'dating' ? 'matches' : 'training partners'}.`
          : `Today’s Super Like is used${superMs !== null ? `, next in ${formatRemaining(superMs)}` : ''}.`}
      </p>
    </dialog>
  )
}

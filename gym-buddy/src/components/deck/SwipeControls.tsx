import { Handshake, Heart, Star, X } from 'lucide-react'
import type { AppMode } from '@/lib/types'

/**
 * Pass · Super Like · Like. All hover/press/drag feedback is in `.ctl` CSS:
 * each button glows on hover AND as the card is dragged toward its action
 * (left, up, right).
 */
export function SwipeControls({
  mode,
  name,
  disabled,
  superLeft,
  onPass,
  onSuper,
  onLike,
}: {
  mode: AppMode
  name?: string
  disabled: boolean
  superLeft: number
  onPass: () => void
  onSuper: () => void
  onLike: () => void
}) {
  const LikeIcon = mode === 'dating' ? Heart : Handshake
  const superDisabled = disabled || superLeft === 0
  return (
    <div className="flex flex-col items-center gap-(--space-panel-gap)">
      <div className="flex items-center justify-center gap-(--space-controls)">
        <button type="button" className="ctl ctl--pass" disabled={disabled} onClick={onPass}
          aria-label={name ? `Pass on ${name}` : 'Pass'}>
          <X className="size-7" strokeWidth={2.5} aria-hidden />
        </button>
        <button type="button" className="ctl ctl--super" disabled={superDisabled} onClick={onSuper}
          aria-label={`Super Like${name ? ` ${name}` : ''} (${superLeft} left today)`}>
          <Star className="size-6" strokeWidth={2.25} fill={superDisabled ? 'none' : 'currentColor'} aria-hidden />
          <span className="ctl-badge" aria-hidden>{superLeft}</span>
        </button>
        <button type="button" className="ctl ctl--like" disabled={disabled} onClick={onLike}
          aria-label={name ? (mode === 'dating' ? `Like ${name}` : `Train with ${name}`) : 'Like'}>
          <LikeIcon className="size-9" strokeWidth={2.25} fill={mode === 'dating' ? 'currentColor' : 'none'} aria-hidden />
        </button>
      </div>
      <p className="hidden items-center gap-2 text-xs text-muted-fg md:flex" aria-hidden>
        <kbd className="kbd">←</kbd> pass <span className="mx-1 opacity-40">·</span>
        <kbd className="kbd">↑</kbd> super <span className="mx-1 opacity-40">·</span>
        <kbd className="kbd">→</kbd> {mode === 'dating' ? 'like' : 'train'}
      </p>
    </div>
  )
}

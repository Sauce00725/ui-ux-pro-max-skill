import type { AppMode, DiscoveryCard, LikeTarget } from '@/lib/types'
import { ProfileCard } from './ProfileCard'
import type { useSwipeGesture } from './useSwipeGesture'

/** Top card gets the gesture; the rest are inert, depth-indexed backdrops. */
export function CardStack({
  stack,
  mode,
  gesture,
  onLikeItem,
}: {
  stack: DiscoveryCard[]
  mode: AppMode
  gesture: Pick<ReturnType<typeof useSwipeGesture>, 'cardRef' | 'handlers'>
  onLikeItem?: (card: DiscoveryCard, target: LikeTarget) => void
}) {
  return (
    <div className="absolute inset-0 bottom-[calc(var(--space-stack)*2)]">
      {stack.map((card, depth) => (
        <ProfileCard
          key={card.id}
          card={card}
          depth={depth}
          mode={mode}
          ref={depth === 0 ? gesture.cardRef : undefined}
          handlers={depth === 0 ? gesture.handlers : undefined}
          onLikeItem={depth === 0 && onLikeItem ? (target) => onLikeItem(card, target) : undefined}
        />
      ))}
    </div>
  )
}

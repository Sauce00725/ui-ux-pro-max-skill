import { cn } from '@/lib/utils'

/**
 * The stage is the element useSwipeGesture writes its live signals to
 * (--like-strength etc.). The light beneath the cards reads them, so it
 * blooms volt on a like, heat on a pass and ultraviolet on a Super Like. A
 * static track floor gives the deck somewhere to stand; the light streak
 * behind everything is the app-wide ambient (AmbientBackground).
 */
export function DeckStage({
  ref,
  style,
  className,
  children,
}: {
  ref?: React.Ref<HTMLDivElement>
  style?: React.CSSProperties
  className?: string
  children: React.ReactNode
}) {
  return (
    <div ref={ref} style={style} className={cn('deck-stage', className)}>
      <div aria-hidden className="deck-orbs">
        <div className="deck-orb deck-orb--rose" />
        <div className="deck-orb deck-orb--ember" />
        <div className="deck-orb deck-orb--tide" />
        <div className="deck-horizon" />
        <div className="deck-grid" />
      </div>
      {children}
    </div>
  )
}

import { cn } from '@/lib/utils'

/**
 * The stage is the element useSwipeGesture writes its live signals to
 * (--like-strength etc.). The light beneath the glass reads them, so it
 * blooms cyan on a like, red on a pass and magenta on a Super Like. A static
 * floor grid gives the deck a room to stand in; the slow-moving light behind
 * everything is the app-wide aurora (AmbientBackground).
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
      {/* Screen-edge light rails, for themes that signal intent at the edges (off by default). */}
      <div aria-hidden className="deck-rails">
        <span />
        <span />
      </div>
      {children}
    </div>
  )
}

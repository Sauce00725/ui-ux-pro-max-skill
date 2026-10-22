import { cn } from '@/lib/utils'

/**
 * The stage is the element useSwipeGesture writes its live signals to
 * (--like-strength etc.). The glowing shapes beneath the glass read them, so
 * the ambient light shifts toward cyan on a like and magenta on a pass.
 * Underneath, a perspective grid floor flows toward the viewer: the page's
 * single ambient loop (stopped under prefers-reduced-motion).
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

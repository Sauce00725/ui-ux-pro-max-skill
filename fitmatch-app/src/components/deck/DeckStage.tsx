import { cn } from '@/lib/utils'

/**
 * The stage is the element useSwipeGesture writes its live signals to
 * (--like-strength etc.). The glowing shapes beneath the glass read them, so
 * the ambient light warms toward ember on a like and rose on a pass.
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
        <div className="deck-orb deck-orb--rose animate-drift" />
        <div className="deck-orb deck-orb--ember animate-drift [animation-delay:-11s]" />
        <div className="deck-orb deck-orb--tide animate-breathe" />
      </div>
      {children}
    </div>
  )
}

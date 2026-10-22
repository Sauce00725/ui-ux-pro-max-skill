import { useId } from 'react'
import { cn } from '@/lib/utils'

/*
 * Gym Buddy mark: two figures (head + capsule body) linked by a bar.
 * From a distance it reads as a dumbbell; up close it's two people holding
 * on to each other: training together, which is the whole product.
 *
 * Geometry is shared with public/icon assets (app/icon.svg); keep in sync.
 * Colors come from the --logo-* tokens, so the mark follows the theme.
 */

/** `linking`: the two figures slide together and the bar locks between them (the match moment). */
export function LogoMark({ className, title, linking = false }: { className?: string; title?: string; linking?: boolean }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--logo-1)' }} />
          <stop offset="0.45" style={{ stopColor: 'var(--logo-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-3)' }} />
        </linearGradient>
        <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill={`url(#${id}-g)`} filter={`url(#${id}-glow)`}>
        {/* left buddy */}
        <g className={linking ? 'match-mark-left' : undefined}>
          <circle cx="15" cy="14.5" r="5.5" />
          <rect x="9" y="23" width="12" height="27" rx="6" />
        </g>
        {/* right buddy */}
        <g className={linking ? 'match-mark-right' : undefined}>
          <circle cx="49" cy="14.5" r="5.5" />
          <rect x="43" y="23" width="12" height="27" rx="6" />
        </g>
        {/* the link / bar */}
        <rect x="19" y="33.5" width="26" height="5" rx="2.5" className={linking ? 'match-mark-bar' : undefined} />
      </g>
    </svg>
  )
}

const SIZES = {
  sm: { mark: 'size-7', text: 'text-base' },
  md: { mark: 'size-10', text: 'text-xl' },
  lg: { mark: 'size-14', text: 'text-3xl' },
} as const

/** Mark + wordmark. "GYM" in white, "BUDDY" in volt. */
export function Logo({
  size = 'md',
  showWordmark = true,
  className,
}: {
  size?: keyof typeof SIZES
  showWordmark?: boolean
  className?: string
}) {
  const s = SIZES[size]
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={cn(s.mark, 'shrink-0')} title={showWordmark ? undefined : 'Gym Buddy'} />
      {showWordmark && (
        <span className={cn('font-display font-black uppercase leading-none tracking-wide font-stretch-125%', s.text)}>
          Gym <span className="text-primary">Buddy</span>
        </span>
      )}
    </span>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { LogoMark } from '@/components/Logo'
import { Slam } from '@/components/Slam'
import { Button } from '@/components/ui/Button'
import type { AppMode, DiscoveryCard } from '@/lib/types'
import { GOAL_LABELS } from '@/lib/validation'

// Light that bursts from the collision, as [angle, reach]. Uneven on purpose.
const SHARDS: [number, number][] = [
  [-84, 150], [-58, 190], [-32, 150], [-8, 210], [14, 160], [38, 200], [64, 150], [92, 180],
  [118, 160], [146, 205], [172, 150], [198, 195], [226, 155], [252, 185],
]

/**
 * The match moment, played once as a short scene:
 *
 *   photos from either side collide → flash, shards, a shake → the logo's two
 *   figures lock → the headline lands letter by letter → the rest rises.
 *
 * Under reduced motion the scene simply appears in its final arrangement.
 * It closes on a short, faster exit (Esc and "Keep looking" both use it).
 */
export function MatchDialog({
  mode,
  card,
  matchId,
  selfPhoto,
  onClose,
}: {
  mode: AppMode
  card: DiscoveryCard
  matchId: string
  /** Your own first photo; without one, the logo takes its place. */
  selfPhoto?: string | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeTimer = useRef(0)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    ref.current?.showModal()
    return () => window.clearTimeout(closeTimer.current)
  }, [])

  /** Exit faster than the entrance; a plain timer, so it works with or without the animation. */
  function leave() {
    if (closing) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return ref.current?.close()
    setClosing(true)
    closeTimer.current = window.setTimeout(() => ref.current?.close(), 220)
  }

  // Fixed line breaks, sized to the stage (cqi): letters land one by one, so the title must never re-wrap.
  const title = mode === 'dating' ? ['It’s a match'] : ['New training', 'partner']
  const titleStart = 460 // ms: just after the impact
  const lineDelay = (line: number) => titleStart + title.slice(0, line).join('').length * 34

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        leave()
      }}
      aria-labelledby="match-title"
      className="match-scene"
      data-closing={closing || undefined}
    >
      <div className="match-veil" aria-hidden />
      <div className="match-flash" aria-hidden />

      <div className="match-stage">
        <div className="match-photos">
          <figure className="match-photo match-photo--you">
            {selfPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selfPhoto} alt="" />
            ) : (
              <span className="match-photo-blank">
                <LogoMark className="size-16" />
              </span>
            )}
            <figcaption className="match-tag hud-label">You</figcaption>
          </figure>
          <figure className="match-photo match-photo--them">
            {card.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.photos[0]} alt="" />
            ) : (
              <span className="match-photo-blank">
                <LogoMark className="size-16" />
              </span>
            )}
            <figcaption className="match-tag hud-label">{card.name}</figcaption>
          </figure>
          <span className="match-badge glass-strong">
            <LogoMark linking className="size-9" />
          </span>
          <div className="match-shards" aria-hidden>
            {SHARDS.map(([a, r]) => (
              <i key={a} className="match-shard" style={{ '--a': `${a}deg`, '--r': `${r}px` } as React.CSSProperties} />
            ))}
          </div>
        </div>

        <p className="hud-label rise mt-2 text-primary" style={{ '--rise-delay': '420ms' } as React.CSSProperties}>
          {mode === 'dating' ? '// Signal returned' : '// Link established'}
        </p>
        <h2 id="match-title" className="match-title font-display font-black uppercase">
          {title.map((line, i) => (
            <span key={line} className="block whitespace-nowrap">
              <Slam text={line} delay={lineDelay(i)} />
            </span>
          ))}
        </h2>
        <p className="rise mt-3 text-muted-fg" style={{ '--rise-delay': '900ms' } as React.CSSProperties}>
          You and {card.name} {mode === 'dating' ? 'liked each other.' : 'both want to train together.'}
          {card.sharedGoals[0]
            ? ` You’re both working to ${GOAL_LABELS[card.sharedGoals[0] as keyof typeof GOAL_LABELS]?.toLowerCase() ?? 'reach your goals'}.`
            : card.sharedActivities[0] && ` You both do ${card.sharedActivities[0].toLowerCase()}.`}
        </p>
        <div className="match-actions rise" style={{ '--rise-delay': '1100ms' } as React.CSSProperties}>
          <Link href={`/matches/${matchId}`} className="btn-primary inline-flex h-12 items-center justify-center rounded-full font-semibold">
            Send a message
          </Link>
          <Button variant="ghost" onClick={leave}>Keep looking</Button>
        </div>
      </div>
    </dialog>
  )
}

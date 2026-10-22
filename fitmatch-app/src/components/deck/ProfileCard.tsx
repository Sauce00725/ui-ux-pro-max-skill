'use client'

import { useState } from 'react'
import { BadgeCheck, ChevronUp, Clock, Dumbbell, MapPin, Sparkles } from 'lucide-react'
import { FITNESS_LEVELS, TRAINING_TIME_LABELS } from '@/lib/validation'
import type { AppMode, DiscoveryCard } from '@/lib/types'

const MAX_CHIPS = 4

type Handlers = Pick<
  React.HTMLAttributes<HTMLElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
>

/**
 * Pure display. Position in the stack is a single number (`depth`); every
 * visual consequence of depth (offset, scale, fade, z-order) and of the live
 * drag (translate, rotate, stamps, edge glow) is resolved in CSS.
 */
export function ProfileCard({
  card,
  depth,
  mode,
  ref,
  handlers,
}: {
  card: DiscoveryCard
  depth: number
  mode: AppMode
  ref?: React.Ref<HTMLElement>
  handlers?: Handlers
}) {
  const isTop = depth === 0
  const [photo, setPhoto] = useState(0)
  const [open, setOpen] = useState(false)

  const chips = [
    ...card.sharedActivities.map((name) => ({ name, shared: true })),
    ...card.otherActivities.map((name) => ({ name, shared: false })),
  ]
  const level = card.fitnessLevel ? FITNESS_LEVELS[card.fitnessLevel - 1] : null
  const times = card.trainingTimes
    .map((t) => TRAINING_TIME_LABELS[t as keyof typeof TRAINING_TIME_LABELS] ?? t)
    .join(' · ')

  return (
    <article
      ref={ref}
      className="deck-card hud-frame"
      data-top={isTop || undefined}
      style={{ '--depth': depth } as React.CSSProperties}
      inert={!isTop}
      aria-hidden={!isTop || undefined}
      aria-label={`${card.name}, ${card.age}, ${card.distanceMi} miles away`}
      {...(isTop ? handlers : undefined)}
    >
      {card.photos[photo] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.photos[photo]}
          alt=""
          draggable={false}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div className="deck-scrim" />
      <div className="hud-scanlines" />
      <div className="deck-scan" />

      {/* Range readout */}
      <p className="deck-readout hud-label glass absolute left-(--space-card) top-[calc(var(--space-card)+14px)] rounded-chip px-2 py-1 text-fg shadow-none">
        <span className="text-primary" aria-hidden>◢</span> {String(card.distanceMi).padStart(2, '0')} mi
      </p>

      {/* Photo segments + tap zones (taps stay clicks: the gesture only captures after 6px) */}
      {card.photos.length > 1 && (
        <>
          <div className="absolute inset-x-(--space-card) top-(--space-card) flex gap-1.5" aria-hidden>
            {card.photos.map((_, i) => (
              <span key={i} className="deck-segment" data-active={i === photo || undefined} />
            ))}
          </div>
          <button
            type="button"
            aria-label="Previous photo"
            className="absolute left-0 top-0 h-3/5 w-1/3 cursor-[inherit]"
            onClick={() => setPhoto((p) => Math.max(0, p - 1))}
          />
          <button
            type="button"
            aria-label="Next photo"
            className="absolute right-0 top-0 h-3/5 w-1/3 cursor-[inherit]"
            onClick={() => setPhoto((p) => Math.min(card.photos.length - 1, p + 1))}
          />
        </>
      )}

      {/* Intent stamps: opacity/scale come from the live swipe signals */}
      <span className="deck-stamp deck-stamp--like" aria-hidden>
        {mode === 'dating' ? 'Like' : 'Train'}
      </span>
      <span className="deck-stamp deck-stamp--pass" aria-hidden>
        Pass
      </span>

      {/* Info panel */}
      <div className="absolute inset-x-0 bottom-0 p-(--space-panel-gap)">
        <div className="glass-strong space-y-(--space-panel-gap) rounded-panel p-(--space-card)">
          <p className="hud-label flex items-center gap-1.5">
            <MapPin className="size-3.5 text-primary" aria-hidden />
            {card.city ?? 'Nearby'}
            {card.state ? `, ${card.state}` : ''}
            {card.isVerified && (
              <span className="ml-auto flex items-center gap-1 text-primary">
                <BadgeCheck className="size-3.5" aria-hidden /> Verified
              </span>
            )}
          </p>

          <div className="flex items-end justify-between gap-3">
            <h2 className="min-w-0 truncate font-display text-display font-bold uppercase text-fg">
              {card.name}
              <span className="ml-2 font-mono text-title font-normal text-primary">{card.age}</span>
            </h2>
            <button
              type="button"
              data-no-drag
              aria-expanded={open}
              aria-label={open ? 'Hide details' : 'Show details'}
              onClick={() => setOpen((o) => !o)}
              className="ctl size-11 shrink-0 [--ctl-size:calc(var(--step)*11)]"
            >
              <ChevronUp className={open ? 'size-5 rotate-180' : 'size-5'} aria-hidden />
            </button>
          </div>

          {card.headline && (
            <p className="border-l border-primary/60 pl-3 text-[1.0625rem] leading-snug text-fg/90">{card.headline}</p>
          )}

          {chips.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="hud-label">Shared</span>
              <span className="hud-meter" aria-hidden>
                {chips.map(({ name, shared }) => <span key={name} data-on={shared || undefined} />)}
              </span>
              <span className="hud-label text-fg">
                {card.sharedActivities.length}/{chips.length}
                <span className="sr-only"> activities in common</span>
              </span>
            </div>
          )}

          {chips.length > 0 && (
            <ul className="flex flex-wrap gap-(--space-chip-gap)" aria-label="Activities">
              {chips.slice(0, MAX_CHIPS).map(({ name, shared }) => (
                <li key={name} className={shared ? 'chip chip--shared' : 'chip'}>
                  {shared && <Sparkles className="size-3.5 text-primary" aria-hidden />}
                  {name}
                  {shared && <span className="sr-only">(you both do this)</span>}
                </li>
              ))}
              {chips.length > MAX_CHIPS && <li className="chip text-muted-fg">+{chips.length - MAX_CHIPS}</li>}
            </ul>
          )}

          <div className="deck-details" data-open={open || undefined}>
            <div data-no-drag className="max-h-44 space-y-(--space-panel-gap) overflow-y-auto overscroll-contain">
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-muted-fg">
                {level && (
                  <span className="flex items-center gap-1.5"><Dumbbell className="size-4" aria-hidden />{level}</span>
                )}
                {times && (
                  <span className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden />{times}</span>
                )}
              </div>
              {card.bio && <p className="whitespace-pre-line leading-relaxed text-fg/90">{card.bio}</p>}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

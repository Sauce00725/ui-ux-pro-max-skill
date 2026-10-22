'use client'

import { useState } from 'react'
import { BadgeCheck, ChevronUp, Clock, Dumbbell, HeartHandshake, MapPin, MessageCircleHeart, Navigation, Sparkles, Sprout, Star, Target } from 'lucide-react'
import { BEGINNER_MAX_LEVEL, FITNESS_LEVELS, GOAL_LABELS, PROMPTS, TRAINING_TIME_LABELS } from '@/lib/validation'
import { TranslateToggle } from '@/components/translate/TranslateToggle'
import { useFitStretch } from '@/components/useFitStretch'
import { useTranslation } from '@/components/translate/useTranslation'
import type { AppMode, DiscoveryCard, LikeTarget, ProfilePrompt } from '@/lib/types'
import { fitStretch } from '@/lib/utils'

const MAX_CHIPS = 4
/** Name characters that fit beside the age at normal width (first-paint guess; useFitStretch measures). */
const NAME_CHARS = 9.5

type Handlers = Pick<
  React.HTMLAttributes<HTMLElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
>

/**
 * Pure display. Position in the stack is a single number (`depth`); every
 * visual consequence of depth (offset, scale, fade, z-order) and of the live
 * drag (translate, rotate, tilt, glare, stamps, edge glow) is resolved in CSS.
 *
 * The article moves in the plane; `.deck-face` inside it tilts in 3D, with
 * its layers (photo → glare → panel → rim) at different parallax depths.
 *
 * `onLikeItem` (optional) adds Hinge-style "like this photo/prompt" buttons;
 * the parent decides what happens (open the comment composer).
 */
export function ProfileCard({
  card,
  depth,
  mode,
  ref,
  handlers,
  onLikeItem,
}: {
  card: DiscoveryCard
  depth: number
  mode: AppMode
  ref?: React.Ref<HTMLElement>
  handlers?: Handlers
  onLikeItem?: (target: LikeTarget) => void
}) {
  const isTop = depth === 0
  const [photo, setPhoto] = useState(0)
  const [open, setOpen] = useState(false)
  // Long names condense along Anybody's width axis instead of truncating.
  const nameRef = useFitStretch<HTMLHeadingElement>(card.name)

  const chips = [
    ...card.sharedActivities.map((name) => ({ name, shared: true })),
    ...card.otherActivities.map((name) => ({ name, shared: false })),
  ]
  const level = card.fitnessLevel ? FITNESS_LEVELS[card.fitnessLevel - 1] : null
  const startingOut = card.fitnessLevel !== null && card.fitnessLevel <= BEGINNER_MAX_LEVEL
  const goalLabel = (g: string) => GOAL_LABELS[g as keyof typeof GOAL_LABELS] ?? g
  const [firstPrompt, ...morePrompts] = card.prompts

  // Everything they wrote (headline, bio, prompt answers) translates in one tap.
  // Slots: 0 = headline, 1 = bio, 2 + k = prompt k.
  const written = [card.headline, card.bio, ...card.prompts.map((p) => p.answer)]
  const slots = written.flatMap((text, slot) => (text?.trim() ? [{ slot, text: text.trim() }] : []))
  const translation = useTranslation(slots.map((s) => s.text))
  const show = (slot: number, original: string) => {
    const i = slots.findIndex((s) => s.slot === slot)
    return i < 0 ? original : translation.shown(i, original)
  }
  const times = card.trainingTimes
    .map((t) => TRAINING_TIME_LABELS[t as keyof typeof TRAINING_TIME_LABELS] ?? t)
    .join(' · ')

  return (
    <article
      ref={ref}
      className="deck-card"
      data-top={isTop || undefined}
      style={{ '--depth': depth } as React.CSSProperties}
      inert={!isTop}
      aria-hidden={!isTop || undefined}
      aria-label={`${card.name}, ${card.age}, ${card.distanceMi} miles away`}
      {...(isTop ? handlers : undefined)}
    >
      <div className="deck-face">
        {card.photos[photo] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.photos[photo]} alt="" draggable={false} decoding="async" className="deck-photo" />
        )}
        <div className="deck-scrim" />
        <div className="deck-sweep" />
        <div className="deck-glare" />

        {/* Range readout */}
        <p className="deck-readout hud-label glass glass-flat absolute left-(--space-card) top-[calc(var(--space-card)+14px)] flex items-center gap-1.5 rounded-full px-2.5 py-1 text-fg">
          <Navigation className="size-3 text-primary" aria-hidden />
          {card.distanceMi} mi
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
        <span className="deck-stamp deck-stamp--super" aria-hidden>
          Super
        </span>

        {/* Like this photo (Hinge-style). Hidden while the details cover the photo. */}
        {onLikeItem && !open && card.photos[photo] && card.photoIds[photo] && (
          <button
            type="button"
            data-no-drag
            className="like-item deck-readout absolute right-(--space-card) top-[calc(var(--space-card)+14px)] z-6"
            aria-label={`Like this photo of ${card.name}`}
            onClick={() => onLikeItem({ kind: 'photo', id: card.photoIds[photo], url: card.photos[photo] })}
          >
            <MessageCircleHeart className="size-5" aria-hidden />
          </button>
        )}

        {/* Info panel: the closest parallax layer */}
        <div className="absolute inset-x-0 bottom-0 p-(--space-panel-gap)">
          <div className="deck-panel glass-strong space-y-(--space-panel-gap) p-(--space-card)">
            <div className="deck-foil" aria-hidden />
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
              <h2
                ref={nameRef}
                className="min-w-0 flex-1 truncate font-display text-display font-extrabold uppercase text-fg"
                style={{ fontStretch: fitStretch(card.name, NAME_CHARS) }}
              >
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

            {(card.superLikedMe || card.helpsBeginners || startingOut) && (
              <div className="flex flex-wrap gap-(--space-chip-gap)">
                {card.superLikedMe && (
                  <span className="chip border-[color:var(--color-super)] text-[color:var(--color-super)] shadow-[0_0_14px_-4px_var(--color-super)]">
                    <Star className="size-3.5" fill="currentColor" aria-hidden /> Super liked you
                  </span>
                )}
                {card.helpsBeginners && (
                  <span className="chip border-accent/60 text-accent">
                    <HeartHandshake className="size-3.5" aria-hidden /> Beginner-friendly
                  </span>
                )}
                {startingOut && (
                  <span className="chip border-secondary/60 text-secondary-fg">
                    <Sprout className="size-3.5" aria-hidden /> Starting out
                  </span>
                )}
              </div>
            )}

            <TranslateToggle t={translation} what="profile" />

            {card.headline && (
              <p className="border-l border-primary/60 pl-3 text-[1.0625rem] leading-snug text-fg/90">{show(0, card.headline)}</p>
            )}

            {card.goals.length > 0 && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Target className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="sr-only">Goals: </span>
                {card.goals.map((g, i) => {
                  const shared = card.sharedGoals.includes(g)
                  return (
                    <span key={g} className={shared ? 'font-semibold text-primary' : 'text-fg/85'}>
                      {goalLabel(g)}
                      {shared && <span className="sr-only"> (your goal too)</span>}
                      {i < card.goals.length - 1 && <span className="ml-2 text-muted-fg" aria-hidden>·</span>}
                    </span>
                  )
                })}
              </p>
            )}

            {/* On a short card the first prompt moves into the details (see .deck-lead-prompt), so the photo stays visible. */}
            {firstPrompt && (
              <div className="deck-lead-prompt">
                <PromptBlock prompt={firstPrompt} answer={show(2, firstPrompt.answer)} name={card.name} onLike={onLikeItem} />
              </div>
            )}

            <div className="deck-details" data-open={open || undefined}>
              <div data-no-drag className="deck-details-scroll space-y-(--space-panel-gap) overflow-y-auto overscroll-contain pt-1">
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
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-muted-fg">
                  {level && (
                    <span className="flex items-center gap-1.5"><Dumbbell className="size-4" aria-hidden />{level}</span>
                  )}
                  {times && (
                    <span className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden />{times}</span>
                  )}
                </div>
                {card.bio && <p className="whitespace-pre-line leading-relaxed text-fg/90">{show(1, card.bio)}</p>}
                {firstPrompt && (
                  <div className="deck-overflow-prompt">
                    <PromptBlock prompt={firstPrompt} answer={show(2, firstPrompt.answer)} name={card.name} onLike={onLikeItem} />
                  </div>
                )}
                {morePrompts.map((p, j) => (
                  <PromptBlock key={p.id} prompt={p} answer={show(3 + j, p.answer)} name={card.name} onLike={onLikeItem} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="deck-rim" aria-hidden />
      </div>
    </article>
  )
}

function PromptBlock({
  prompt,
  answer,
  name,
  onLike,
}: {
  prompt: ProfilePrompt
  /** What to display: the answer, or its translation. Likes always reference the original. */
  answer: string
  name: string
  onLike?: (target: LikeTarget) => void
}) {
  const question = PROMPTS[prompt.key as keyof typeof PROMPTS] ?? prompt.key
  return (
    <div className="flex items-start gap-3 rounded-chip border border-[color:var(--glass-stroke)] bg-[color:var(--glass-fill)] p-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
      <div className="min-w-0 flex-1">
        <p className="hud-label">{question}</p>
        <p className="mt-1 text-[1.0625rem] font-semibold leading-snug text-fg">{answer}</p>
      </div>
      {onLike && (
        <button
          type="button"
          data-no-drag
          className="like-item"
          aria-label={`Like ${name}’s answer: ${question}`}
          onClick={() => onLike({ kind: 'prompt', id: prompt.id, key: prompt.key, answer: prompt.answer })}
        >
          <MessageCircleHeart className="size-5" aria-hidden />
        </button>
      )}
    </div>
  )
}

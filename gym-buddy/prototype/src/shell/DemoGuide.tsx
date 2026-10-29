import { useEffect, useRef, useState } from 'react'
import { FlaskConical, RotateCcw, Rewind, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { bus } from '../bus'
import { tools } from '../demo/world'
import { useAppRouter } from '../router'

/*
 * The only part of the prototype that isn't the app: a small pill beside the
 * profile button that opens a guide (what to try, in a sensible order) and a
 * few tools for reaching states that would otherwise take hours (the 6-hour
 * refill) or luck (a match).
 */

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Open the app',
    body: 'Tap Create account on the landing page (no details needed). Watch the headline land; replay it any time below.',
  },
  {
    title: 'Get a match',
    body: 'In Match, swipe the first card right, or tap ♥, or press →. Jordan likes you back, so the match scene plays. The volt “Something long-term” chip means Jordan wants what you want.',
  },
  {
    title: 'Try every way to swipe',
    body: 'Drag the card (it leans and tosses), tap ✕ ★ ♥, or use ← ↑ →. Swipe up for your one Super Like a day. Watch the picks ring count down.',
  },
  {
    title: 'Look closer at a profile',
    body: 'Tap the photo’s left or right edge to flip photos, ⌃ for the details, and the speech-heart on a photo or answer to like it with a comment.',
  },
  {
    title: 'Switch to Partners',
    body: 'The dock’s bead stretches to the new tab and the screen slides the way you travelled. Alexandria super-liked you here.',
  },
  {
    title: 'Start the conversation',
    body: 'From the match, tap Send a message. Tap an opener, or the calendar to plan a date from nearby events and ideas you’d both like. It fills your message; you send it.',
  },
  {
    title: 'Likes, then chat',
    body: 'Likes shows who liked you first; liking back is free. Chats marks whose turn it is. Open Marisol, tap Translate on her Spanish, then send a message and wait for the reply.',
  },
  {
    title: 'Events and profile',
    body: 'RSVP, change the filters, or post an event. The profile button (top right) opens Settings, where every section edits and “saves”.',
  },
]

export function DemoGuide() {
  const { path } = useAppRouter()
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState<'waiting' | 'shown' | 'done'>('waiting')

  // Once the landing intro has played, point at the guide for anyone who hasn't found it.
  useEffect(() => {
    if (path !== '/' || open) return
    const show = window.setTimeout(() => setHint((h) => (h === 'waiting' ? 'shown' : h)), 3200)
    const hide = window.setTimeout(() => setHint('done'), 12_000)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(hide)
    }
  }, [path, open])

  if (path.startsWith('/matches/')) return null // the chat header needs its right edge
  const early = path === '/' || path === '/login' || path === '/signup'

  return (
    <>
      <div className="demo-pill-rail" data-early={early || undefined}>
        <button
          type="button"
          className="demo-pill glass glass-flat hud-label text-fg"
          onClick={() => {
            setOpen(true)
            setHint('done')
          }}
          aria-haspopup="dialog"
        >
          <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" aria-hidden />
          Prototype
        </button>
        {hint === 'shown' && path === '/' && !open && (
          <p className="demo-hint rise glass glass-flat" role="note">
            New here? Open the guide.
          </p>
        )}
      </div>
      {open && <Guide onClose={() => setOpen(false)} />}
    </>
  )
}

function Guide({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [nextMatches, setNextMatches] = useState(tools.nextMatches)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const close = () => ref.current?.close()
  /** Run a tool, close the guide, and land where the effect shows. */
  const run = (go: string | null, tool: () => void) => {
    tool()
    if (go) bus.navigate(go)
    close()
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="guide-title"
      className="glass-strong m-auto flex max-h-[min(90dvh,46rem)] w-[calc(100%-1.5rem)] max-w-md flex-col overflow-hidden rounded-card p-0 text-fg backdrop:bg-black/75 backdrop:backdrop-blur-sm"
    >
      <header className="flex items-start justify-between gap-3 px-(--space-card) pb-3 pt-(--space-card)">
        <div>
          <p className="hud-label text-primary">// Prototype guide</p>
          <h2 id="guide-title" className="font-display text-title font-black uppercase">Try everything</h2>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close guide"
          className="glass glass-flat -mr-1 grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-200 hover:bg-(--glass-fill-hover)"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-(--space-card) pb-(--space-card)">
        <p className="text-sm text-muted-fg">
          These are the real Gym Buddy screens, motion and components. The people, photos and events are invented, there’s no
          account, and nothing is saved or sent. Reloading starts over.
        </p>

        <ol className="mt-4 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="hud-label mt-0.5 w-5 shrink-0 text-primary tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-fg">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h3 className="hud-label mt-6 text-primary">// Shortcuts</h3>
        <div className="mt-2 grid gap-2">
          <ToolButton icon={<Zap className="size-4" aria-hidden />} onClick={() => run('/discover?mode=dating', () => tools.picksLeft(1))}>
            Picks left: 1
            <span className="text-muted-fg">then swipe once to see the quota screen and refill clock</span>
          </ToolButton>
          <ToolButton icon={<Rewind className="size-4" aria-hidden />} onClick={() => run('/discover?mode=dating', () => tools.skipWait())}>
            Skip the 6-hour wait
            <span className="text-muted-fg">fresh picks and a fresh Super Like</span>
          </ToolButton>
          <ToolButton
            icon={<FlaskConical className="size-4" aria-hidden />}
            pressed={nextMatches}
            onClick={() => {
              const on = !nextMatches
              setNextMatches(on)
              tools.setNextMatches(on)
            }}
          >
            Every like is a match
            <span className="text-muted-fg">{nextMatches ? 'on: the next like you send matches' : 'off: only people who like you back match'}</span>
          </ToolButton>
          <ToolButton icon={<Rewind className="size-4" aria-hidden />} onClick={() => run('/', () => bus.remount())}>
            Replay the landing intro
          </ToolButton>
          <ToolButton icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => run('/', () => tools.reset())}>
            Reset the demo
            <span className="text-muted-fg">matches, messages, RSVPs and picks go back to the start</span>
          </ToolButton>
        </div>

        <p className="mt-5 text-xs text-muted-fg">
          Motion follows your device’s Reduce Motion setting: with it on, everything lands on its final state. Photos are
          generated stand-ins.
        </p>
        <Button className="mt-4 w-full" onClick={close}>Back to the app</Button>
      </div>
    </dialog>
  )
}

function ToolButton({
  icon,
  pressed,
  onClick,
  children,
}: {
  icon: React.ReactNode
  pressed?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        'flex min-h-12 items-start gap-3 rounded-panel border px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-200',
        pressed
          ? 'border-primary/70 bg-primary/10 text-primary'
          : 'border-[color:var(--glass-stroke)] bg-(--glass-fill) hover:bg-(--glass-fill-hover)',
      )}
    >
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5 [&>span]:text-xs [&>span]:font-normal">{children}</span>
    </button>
  )
}

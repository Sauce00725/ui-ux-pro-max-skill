'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { AlertCircle, ArrowLeft, Ban, EllipsisVertical, Flag, Heart, MessageCircleHeart, SendHorizontal, Star, UserMinus, Users } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/Button'
import { blockUser, reportUser, unmatch } from '@/app/(app)/matches/actions'
import { PROMPTS, REPORT_REASONS } from '@/lib/validation'
import type { AppMode, ChatMessage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { TranslateToggle } from '@/components/translate/TranslateToggle'
import { useTranslation } from '@/components/translate/useTranslation'
import { useChat } from './useChat'

const MAX_LEN = 2000
const NEAR_BOTTOM_PX = 120

interface Props {
  matchId: string
  mode: AppMode
  currentUserId: string
  other: { name: string; avatarUrl?: string }
  initialMessages: Omit<ChatMessage, 'status'>[]
  initialHasMore: boolean
  /** Signed URLs for photos referenced by "liked your photo" openers, by photo id. */
  contextPhotos?: Record<string, string>
}

export function ChatWindow({ matchId, mode, currentUserId, other, initialMessages, initialHasMore, contextPhotos = {} }: Props) {
  const { messages, send, retry, notifyTyping, otherTyping, connected, hasMore, loadOlder } = useChat({
    matchId,
    currentUserId,
    initialMessages,
    initialHasMore,
  })
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottom = useRef(true)

  // Keep pinned to the newest message unless the user scrolled up to read history.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages, otherTyping])

  // Auto-grow the composer up to ~5 lines.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [draft])

  function submit() {
    if (!draft.trim() || draft.length > MAX_LEN) return
    stickToBottom.current = true
    send(draft)
    setDraft('')
    inputRef.current?.focus()
  }

  async function handleLoadOlder() {
    const el = scrollRef.current
    const prevHeight = el?.scrollHeight ?? 0
    stickToBottom.current = false
    await loadOlder()
    // Preserve the reading position after prepending.
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight
    })
  }

  const lastOwnSent = [...messages].reverse().find((m) => m.sender_id === currentUserId && m.status === 'sent')

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col bg-bg">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link href="/matches" aria-label="Back to chats" className="grid size-11 place-items-center rounded-full hover:bg-card">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <Avatar url={other.avatarUrl} name={other.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{other.name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-fg">
            {mode === 'dating' ? <Heart className="size-3" aria-hidden /> : <Users className="size-3" aria-hidden />}
            {mode === 'dating' ? 'Dating match' : 'Training partner'}
            {!connected && <span className="ml-1 text-primary">· reconnecting…</span>}
          </p>
        </div>
        <SafetyMenu matchId={matchId} name={other.name} />
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
        }}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {hasMore && (
          <div className="mb-4 text-center">
            <Button variant="ghost" className="h-9 text-sm" onClick={handleLoadOlder}>Load earlier messages</Button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-xs text-center text-muted-fg">
            <p className="font-display text-2xl font-bold uppercase text-fg">Say hi to {other.name}</p>
            <p className="mt-2 text-sm">
              {mode === 'buddy' ? 'Try: “What’s your split this week? Want to train together Saturday?”' : 'Ask about their favorite workout or next race.'}
            </p>
          </div>
        )}

        <ol className="space-y-1" aria-live="polite" aria-relevant="additions">
          {messages.map((m, i) => {
            const prev = messages[i - 1]
            const mine = m.sender_id === currentUserId
            const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
            const grouped = !newDay && prev?.sender_id === m.sender_id
            return (
              <li key={m.client_id}>
                {newDay && (
                  <p className="my-4 text-center text-xs font-medium text-muted-fg">
                    {new Date(m.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                )}
                {m.kind === 'like_comment' ? (
                  <LikeOpener
                    message={m}
                    mine={mine}
                    otherName={other.name}
                    photoUrl={m.context?.photo_id ? contextPhotos[m.context.photo_id] : undefined}
                  />
                ) : (
                  <Bubble message={m} mine={mine} grouped={grouped} onRetry={() => retry(m.client_id)} />
                )}
                {mine && m.client_id === lastOwnSent?.client_id && m.read_at && (
                  <p className="mt-0.5 text-right text-xs text-muted-fg">Seen</p>
                )}
              </li>
            )
          })}
        </ol>

        {otherTyping && (
          <div className="mt-2 flex w-16 items-center justify-center gap-1 rounded-2xl rounded-bl-md bg-card px-3 py-3" aria-label={`${other.name} is typing`}>
            {[0, 150, 300].map((d) => (
              <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-fg" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="border-t px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
      >
        <div className="flex items-end gap-2">
          <label htmlFor="message" className="sr-only">Message {other.name}</label>
          <textarea
            id="message"
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={MAX_LEN}
            placeholder="Message…"
            onChange={(e) => {
              setDraft(e.target.value)
              notifyTyping()
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter adds a line. Ignore while an IME is composing.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            className="max-h-36 min-h-12 flex-1 resize-none rounded-3xl border bg-surface px-4 py-3 text-base focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send message"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-hover disabled:bg-muted disabled:text-muted-fg"
          >
            <SendHorizontal className="size-5" aria-hidden />
          </button>
        </div>
        {draft.length > MAX_LEN - 200 && (
          <p className="mt-1 text-right text-xs text-muted-fg">{draft.length}/{MAX_LEN}</p>
        )}
      </form>
    </div>
  )
}

/** The like that started it: what was liked, whether it was a Super Like, and the comment. */
function LikeOpener({
  message,
  mine,
  otherName,
  photoUrl,
}: {
  message: ChatMessage
  mine: boolean
  otherName: string
  photoUrl?: string
}) {
  const ctx = message.context ?? {}
  const what = ctx.photo_id ? 'photo' : ctx.prompt_key ? 'prompt' : 'profile'
  const who = mine ? 'You' : otherName
  const whose = mine ? `${otherName}’s` : 'your'
  const question = ctx.prompt_key ? (PROMPTS[ctx.prompt_key as keyof typeof PROMPTS] ?? ctx.prompt_key) : null
  // Only their words get a Translate option, never your own.
  const translation = useTranslation(!mine && message.body ? [message.body] : [])

  return (
    <div className={cn('mt-3 flex flex-col gap-1.5', mine ? 'items-end' : 'items-start')}>
      <p className={cn('hud-label flex items-center gap-1.5', ctx.super && 'text-[color:var(--color-super)]')}>
        {ctx.super ? <Star className="size-3.5" fill="currentColor" aria-hidden /> : <MessageCircleHeart className="size-3.5 text-primary" aria-hidden />}
        {who} {ctx.super ? 'super liked' : 'liked'} {whose} {what}
      </p>
      {(photoUrl || question) && (
        <div className={cn('max-w-[75%] overflow-hidden rounded-panel border bg-surface', ctx.super ? 'border-[color:var(--color-super)]/50' : 'border-[color:var(--glass-stroke)]')}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={`${mine ? otherName : 'Your'} photo`} className="h-36 w-28 object-cover" />
          ) : (
            <div className="p-3">
              <p className="hud-label">{question}</p>
              <p className="mt-1 font-display text-sm font-medium leading-snug">{ctx.prompt_answer}</p>
            </div>
          )}
        </div>
      )}
      {message.body && (
        <div
          className={cn(
            'max-w-[80%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 leading-snug',
            mine ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md bg-card text-fg',
          )}
        >
          {translation.shown(0, message.body)}
        </div>
      )}
      {!mine && <TranslateToggle t={translation} className="mt-1" />}
    </div>
  )
}

function Bubble({ message, mine, grouped, onRetry }: { message: ChatMessage; mine: boolean; grouped: boolean; onRetry: () => void }) {
  const time = new Date(message.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const translation = useTranslation(mine ? [] : [message.body])
  return (
    <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start', !grouped && 'mt-3')}>
      <div
        title={time}
        className={cn(
          'max-w-[80%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 leading-snug',
          mine ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md bg-card text-fg',
          message.status === 'sending' && 'opacity-70',
          message.status === 'failed' && 'bg-danger/20 text-fg ring-1 ring-danger',
        )}
      >
        {translation.shown(0, message.body)}
      </div>
      {!mine && <TranslateToggle t={translation} className="mt-1" />}
      {message.status === 'failed' ? (
        <button type="button" onClick={onRetry} className="mt-1 flex items-center gap-1 text-xs text-danger hover:underline">
          <AlertCircle className="size-3.5" aria-hidden /> Not sent. Tap to retry
        </button>
      ) : (
        !grouped && <span className="mt-0.5 px-1 text-[11px] text-muted-fg">{time}</span>
      )}
    </div>
  )
}

function SafetyMenu({ matchId, name }: { matchId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'report' | 'block' | 'unmatch' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const items = [
    { key: 'unmatch' as const, label: 'Unmatch', icon: UserMinus },
    { key: 'block' as const, label: `Block ${name}`, icon: Ban },
    { key: 'report' as const, label: 'Report', icon: Flag, danger: true },
  ]

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Safety options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-full hover:bg-card"
      >
        <EllipsisVertical className="size-5" aria-hidden />
      </button>
      {open && (
        <ul role="menu" className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-2xl border bg-surface py-1 shadow-xl">
          {items.map(({ key, label, icon: Icon, danger }) => (
            <li key={key} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  setDialog(key)
                }}
                className={cn('flex min-h-11 w-full items-center gap-3 px-4 text-left hover:bg-card', danger && 'text-danger')}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {dialog === 'report' && <ReportDialog matchId={matchId} name={name} onClose={() => setDialog(null)} />}
      {(dialog === 'block' || dialog === 'unmatch') && (
        <ConfirmDialog
          title={dialog === 'block' ? `Block ${name}?` : `Unmatch ${name}?`}
          body={
            dialog === 'block'
              ? 'They won’t be able to message you or see you in Dating or Training Partners again. They aren’t notified.'
              : 'This conversation will be removed for both of you.'
          }
          confirmLabel={dialog === 'block' ? 'Block' : 'Unmatch'}
          onConfirm={() => (dialog === 'block' ? blockUser(matchId) : unmatch(matchId))}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function useModal(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return { ref, onClose, className: 'm-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-surface p-6 text-fg backdrop:bg-black/70' }
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const modal = useModal(onClose)
  const [pending, startTransition] = useTransition()
  return (
    <dialog {...modal}>
      <h2 className="font-display text-2xl font-bold uppercase">{title}</h2>
      <p className="mt-2 text-muted-fg">{body}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => modal.ref.current?.close()}>Cancel</Button>
        <Button variant="danger" loading={pending} onClick={() => startTransition(onConfirm)}>{confirmLabel}</Button>
      </div>
    </dialog>
  )
}

function ReportDialog({ matchId, name, onClose }: { matchId: string; name: string; onClose: () => void }) {
  const modal = useModal(onClose)
  const [reason, setReason] = useState<keyof typeof REPORT_REASONS | ''>('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string>()
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  if (done) {
    return (
      <dialog {...modal} onClose={() => (window.location.href = '/matches')}>
        <h2 className="font-display text-2xl font-bold uppercase">Thanks for telling us</h2>
        <p className="mt-2 text-muted-fg">
          Our team reviews every report. You won’t see {name} again. If you’re in danger, call 911.
        </p>
        <Button className="mt-6 w-full" onClick={() => modal.ref.current?.close()}>Done</Button>
      </dialog>
    )
  }

  return (
    <dialog {...modal}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          startTransition(async () => {
            const res = await reportUser({ matchId, reason, details })
            if (res.ok) setDone(true)
            else setError(res.message)
          })
        }}
      >
        <h2 className="font-display text-2xl font-bold uppercase">Report {name}</h2>
        <p className="mt-1 text-sm text-muted-fg">Reports are confidential. We’ll also block them for you.</p>
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Reason</legend>
          {Object.entries(REPORT_REASONS).map(([key, label]) => (
            <label key={key} className={cn('flex min-h-11 items-center gap-3 rounded-xl border px-3', reason === key && 'border-primary bg-primary/10')}>
              <input type="radio" name="reason" value={key} checked={reason === key} className="accent-primary"
                onChange={() => setReason(key as keyof typeof REPORT_REASONS)} />
              {label}
            </label>
          ))}
        </fieldset>
        <label htmlFor="report-details" className="mt-4 block text-sm font-medium text-muted-fg">Anything else? (optional)</label>
        <textarea id="report-details" value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)}
          className="mt-1.5 min-h-20 w-full resize-none rounded-xl border bg-bg px-3 py-2 focus:border-primary focus:outline-none" />
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => modal.ref.current?.close()}>Cancel</Button>
          <Button type="submit" variant="danger" loading={pending} disabled={!reason}>Submit report</Button>
        </div>
      </form>
    </dialog>
  )
}

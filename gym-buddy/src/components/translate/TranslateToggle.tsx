'use client'

import { Languages, LoaderCircle } from 'lucide-react'
import { LANG_NAMES } from '@/lib/language'
import { cn } from '@/lib/utils'
import type { TranslationHandle } from './useTranslation'

/**
 * The one-tap control under a message or on a profile:
 * "Translate to English" → "Translating…" → "From Spanish · Show original".
 * Renders nothing when there's nothing to translate.
 */
export function TranslateToggle({ t, what, className }: { t: TranslationHandle; what?: string; className?: string }) {
  if (!t.target || (!t.offer && t.status === 'idle')) return null

  let label: React.ReactNode
  if (t.status === 'loading') label = 'Translating…'
  else if (t.status === 'error') label = `${t.error} Try again`
  else if (t.status === 'translated' && t.alreadyInTarget) label = `Already in ${LANG_NAMES[t.target]}`
  else if (t.showingTranslation) {
    label = (
      <>
        {t.sourceLang && t.sourceLang !== t.target ? `From ${LANG_NAMES[t.sourceLang]}` : 'Translated'}
        <span aria-hidden> · </span>
        <span className="underline underline-offset-2">Show original</span>
      </>
    )
  } else if (t.status === 'translated') label = 'Show translation'
  else label = `Translate${what ? ` ${what}` : ''} to ${LANG_NAMES[t.target]}`

  return (
    <button
      type="button"
      data-no-drag
      onClick={t.toggle}
      disabled={t.status === 'loading' || (t.status === 'translated' && t.alreadyInTarget)}
      aria-live="polite"
      className={cn(
        // 44px hit area without adding 44px of layout under every message.
        'inline-flex min-h-11 items-center gap-1.5 px-1 -my-2 text-left font-mono text-[0.6875rem] uppercase tracking-[0.12em] transition-colors',
        t.status === 'error' ? 'text-danger' : 'text-primary hover:text-primary-hover',
        'disabled:cursor-default disabled:opacity-80',
        className,
      )}
    >
      {t.status === 'loading' ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Languages className="size-3.5" aria-hidden />
      )}
      <span className="leading-tight">{label}</span>
    </button>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { detectLanguage, type Lang } from '@/lib/language'
import type { TranslatedText } from '@/lib/types'
import { useTranslator } from './TranslatorContext'
import { useMyLanguage } from './useMyLanguage'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'translated'; results: TranslatedText[]; showing: 'translated' | 'original' }

// Translations already fetched this session, so toggling or re-mounting a card is free.
const sessionCache = new Map<string, TranslatedText[]>()

/**
 * One-tap translation of a group of texts (a message, or a whole profile) into
 * the member's language. `offer` is true when any text looks like it's in the
 * other language, which is when the Translate control should appear.
 */
export function useTranslation(texts: string[]) {
  const translate = useTranslator()
  const [target] = useMyLanguage()
  const key = texts.join('\u0001')
  // State belongs to one set of texts in one language; new texts or a new target start over.
  const scope = `${target}\u0002${key}`
  const [saved, setSaved] = useState<{ scope: string; state: State }>({ scope, state: { status: 'idle' } })
  const state: State = saved.scope === scope ? saved.state : { status: 'idle' }
  const setState = (next: State) => setSaved({ scope, state: next })

  const offer = useMemo(
    () => target !== null && texts.some((t) => {
      const lang = detectLanguage(t)
      return lang !== null && lang !== target
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands in for `texts`
    [key, target],
  )

  async function run() {
    if (!target || texts.length === 0) return
    const cacheKey = `${target}\u0002${key}`
    const hit = sessionCache.get(cacheKey)
    if (hit) return setState({ status: 'translated', results: hit, showing: 'translated' })

    setState({ status: 'loading' })
    const res = await translate({ texts, target }).catch(() => ({
      ok: false as const,
      message: 'Couldn’t reach the translator. Try again.',
    }))
    if (res.ok) {
      sessionCache.set(cacheKey, res.results)
      setState({ status: 'translated', results: res.results, showing: 'translated' })
    } else {
      setState({ status: 'error', message: res.message })
    }
  }

  const showingTranslation = state.status === 'translated' && state.showing === 'translated'
  const results = state.status === 'translated' ? state.results : null

  return {
    offer,
    target: target as Lang | null,
    status: state.status,
    error: state.status === 'error' ? state.message : null,
    showingTranslation,
    /** Detected language of the originals (first one that isn't "other"). */
    sourceLang: results?.map((r) => r.source).find((s): s is Lang => s !== 'other') ?? null,
    /** True when the model found everything already in the member's language. */
    alreadyInTarget: !!results && results.every((r) => r.source === target),
    /** Text to display at `index`: the translation when it's showing, else the original. */
    shown: (index: number, original: string) => (showingTranslation && results?.[index] ? results[index].text : original),
    /** Translate, or flip between translation and original once translated. */
    toggle: () => {
      if (state.status === 'translated') {
        setState({ ...state, showing: state.showing === 'translated' ? 'original' : 'translated' })
      } else if (state.status !== 'loading') {
        void run()
      }
    },
  }
}

export type TranslationHandle = ReturnType<typeof useTranslation>

'use server'

import { z } from 'zod'
import { LANGS } from '@/lib/language'
import { createClient } from '@/lib/supabase/server'
import { cachedTranslation, rememberTranslation, translateWithClaude, translationErrorMessage } from '@/lib/translate'
import type { TranslatedText } from '@/lib/types'

export type TranslateResult = { ok: true; results: TranslatedText[] } | { ok: false; message: string }

const MAX_TEXTS = 8 // a message, or a profile's headline + bio + prompt answers
const MAX_CHARS = 2000 // per text (bios are ≤500, messages ≤2000)
const MAX_TOTAL = 6000

const inputSchema = z
  .object({
    texts: z.array(z.string().trim().min(1).max(MAX_CHARS)).min(1).max(MAX_TEXTS),
    target: z.enum(LANGS),
  })
  .refine((v) => v.texts.reduce((n, t) => n + t.length, 0) <= MAX_TOTAL)

/**
 * Translate member-written text into the viewer's language (Spanish ↔ English).
 * Only signed-in members can call it; cache misses count against a per-member
 * hourly allowance enforced in the database (migration 0007).
 */
export async function translateTexts(input: unknown): Promise<TranslateResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'That’s too long to translate in one go.' }
  const { texts, target } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Your session expired. Log in again.' }

  const results: (TranslatedText | undefined)[] = texts.map((t) => cachedTranslation(t, target))
  const missing = texts.flatMap((t, i) => (results[i] ? [] : [i]))
  if (missing.length === 0) return { ok: true, results: results as TranslatedText[] }

  const { error: quotaError } = await supabase.rpc('consume_translation_quota')
  if (quotaError) {
    if (quotaError.message.includes('translation_limit_reached')) {
      return { ok: false, message: 'You’ve hit the hourly translation limit. Try again a bit later.' }
    }
    console.error('[translate] quota check failed:', quotaError.message)
    return { ok: false, message: 'Translation isn’t available right now.' }
  }

  try {
    const fresh = await translateWithClaude(missing.map((i) => texts[i]), target)
    missing.forEach((textIndex, j) => {
      results[textIndex] = fresh[j]
      rememberTranslation(texts[textIndex], target, fresh[j])
    })
    return { ok: true, results: results as TranslatedText[] }
  } catch (error) {
    return { ok: false, message: translationErrorMessage(error) }
  }
}

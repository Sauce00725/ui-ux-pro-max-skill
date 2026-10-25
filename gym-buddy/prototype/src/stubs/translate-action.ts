import type { TranslateResult } from '@/app/actions/translate'
import { translateDemo } from '../demo/replies'

export type { TranslateResult }

export async function translateTexts(input: unknown): Promise<TranslateResult> {
  const { texts, target } = input as { texts: string[]; target: 'en' | 'es' }
  await new Promise((r) => setTimeout(r, 450 + Math.random() * 350))
  return { ok: true, results: texts.map((t) => translateDemo(t, target)) }
}

'use client'

import { Languages } from 'lucide-react'
import { useMyLanguage } from '@/components/translate/useMyLanguage'
import { LANG_AUTONYMS, LANGS } from '@/lib/language'
import { cn } from '@/lib/utils'

/** Which language "Translate" converts into. Applies instantly; stored on this device. */
export function TranslationPreference() {
  const [lang, setLang] = useMyLanguage()

  return (
    <section className="glass relative space-y-4 rounded-card p-(--space-card) shadow-none" aria-labelledby="s-translation">
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="s-translation" className="flex items-center gap-2 font-display text-lg font-bold uppercase">
          <Languages className="size-5 text-primary" aria-hidden /> Translation
        </h2>
        <span className="hud-label">06</span>
      </header>

      <fieldset>
        <legend className="mb-3 text-sm text-muted-fg">
          Translate messages and profiles into:
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {LANGS.map((l) => (
            <label
              key={l}
              className={cn(
                'flex min-h-12 cursor-pointer items-center justify-center rounded-panel border font-semibold transition-colors',
                lang === l ? 'border-primary bg-primary/10 text-primary' : 'border-[color:var(--glass-stroke)] hover:border-[color:var(--glass-stroke-strong)]',
              )}
            >
              <input type="radio" name="translate-to" value={l} checked={lang === l} onChange={() => setLang(l)} className="sr-only" />
              {LANG_AUTONYMS[l]}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-sm text-muted-fg">
        Messages and profiles written in the other language get a one-tap Translate button. This choice is saved on
        this device. When you tap Translate, that text is sent to Anthropic’s Claude to be translated.
      </p>
    </section>
  )
}

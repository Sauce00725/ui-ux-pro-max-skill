'use client'

import { useCallback, useEffect, useState } from 'react'
import { browserLanguage, type Lang } from '@/lib/language'

/*
 * The language this member wants things translated into. A per-device
 * preference (Settings → Translation), defaulting to the browser's language.
 */

const STORAGE_KEY = 'gb.translate-to'
const listeners = new Set<() => void>()
let override: Lang | null = null // survives when storage is unavailable (private mode)

function read(): Lang {
  if (override) return override
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'es') return stored
  } catch {
    // storage blocked: fall through to the browser language
  }
  return browserLanguage()
}

/** Returns null until mounted, so server and client markup match. */
export function useMyLanguage(): [Lang | null, (lang: Lang) => void] {
  const [lang, setLang] = useState<Lang | null>(null)

  useEffect(() => {
    const sync = () => setLang(read())
    sync()
    listeners.add(sync)
    window.addEventListener('storage', sync)
    return () => {
      listeners.delete(sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const update = useCallback((next: Lang) => {
    override = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // keep the in-memory override
    }
    listeners.forEach((notify) => notify())
  }, [])

  return [lang, update]
}

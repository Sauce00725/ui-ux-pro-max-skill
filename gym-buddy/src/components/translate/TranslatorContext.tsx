'use client'

import { createContext, useContext } from 'react'
import { translateTexts, type TranslateResult } from '@/app/actions/translate'
import type { Lang } from '@/lib/language'

export type Translator = (input: { texts: string[]; target: Lang }) => Promise<TranslateResult>

/** Defaults to the server action; previews and tests can provide a mock. */
const TranslatorContext = createContext<Translator>(translateTexts)

export const TranslatorProvider = TranslatorContext.Provider
export const useTranslator = () => useContext(TranslatorContext)

/*
 * Spanish/English helpers shared by client and server.
 *
 * `detectLanguage` is a cheap, offline heuristic used only to decide whether to
 * *offer* a Translate button. The model decides the real source language when
 * the user taps it, so a wrong guess here costs a hidden button, not a bad
 * translation.
 */

export const LANGS = ['en', 'es'] as const
export type Lang = (typeof LANGS)[number]

export const LANG_NAMES: Record<Lang, string> = { en: 'English', es: 'Spanish' }
/** How each language names itself (for the language picker). */
export const LANG_AUTONYMS: Record<Lang, string> = { en: 'English', es: 'Español' }

// Common function words and chat words that are distinctive for each language.
// Words shared by both (no, me, a, gym, ok…) are deliberately left out.
const ES_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'que', 'qué', 'y', 'en', 'es',
  'son', 'por', 'para', 'con', 'sin', 'pero', 'muy', 'mi', 'mis', 'tu', 'tus', 'su', 'yo', 'tú', 'te', 'se',
  'lo', 'le', 'les', 'nos', 'como', 'cómo', 'cuando', 'cuándo', 'donde', 'dónde', 'porque', 'también',
  'hola', 'gracias', 'sí', 'bueno', 'buena', 'buenos', 'buenas', 'días', 'noches', 'quiero', 'tengo',
  'estoy', 'estás', 'está', 'eres', 'soy', 'vamos', 'hoy', 'mañana', 'entrenar', 'entreno', 'gimnasio',
  'jaja', 'jajaja', 'pues', 'nada', 'todo', 'más', 'ya', 'ahora', 'aquí', 'bien', 'claro', 'vale', 'oye',
  'quieres', 'puedo', 'puedes', 'hacer', 'semana', 'mucho', 'gusta', 'gustaría', 'contigo', 'nosotros',
  'tiempo', 'correr', 'pierna', 'piernas', 'sábado', 'domingo', 'esta', 'este', 'eso', 'esto', 'hay',
])
const EN_WORDS = new Set([
  'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'in', 'on', 'at', 'for',
  'with', 'you', 'your', 'i', "i'm", 'im', 'my', 'we', 'it', "it's", 'that', 'this', 'what', 'how', 'when',
  'where', 'why', 'do', 'does', "don't", 'not', 'have', 'has', 'can', 'will', 'would', 'like', 'just',
  'so', 'hi', 'hey', 'hello', 'thanks', 'thank', 'yes', 'yeah', 'lol', 'want', 'today', 'tomorrow',
  'weekend', 'week', 'train', 'training', 'run', 'running', 'leg', 'day', 'there', 'they', 'about',
  'awesome', 'cool', 'nice', 'great', 'sounds', 'good', 'love', 'see', 'should', 'could', 'up', 'out',
])

/** Best guess at whether `text` is Spanish or English; null when there's no signal. */
export function detectLanguage(text: string): Lang | null {
  const lower = text.toLowerCase()
  let es = 0
  let en = 0

  // Characters that only Spanish uses here.
  if (/[ñ¿¡]/.test(lower)) es += 3
  es += Math.min(2, (lower.match(/[áéíóú]/g) ?? []).length)

  for (const word of lower.match(/[a-záéíóúüñ']+/g) ?? []) {
    if (ES_WORDS.has(word)) es += 1
    else if (EN_WORDS.has(word)) en += 1
  }

  if (es === en) return null // includes "no signal" (0 = 0)
  return es > en ? 'es' : 'en'
}

/** The language to translate into by default: the browser's, if it's one we support. */
export function browserLanguage(): Lang {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

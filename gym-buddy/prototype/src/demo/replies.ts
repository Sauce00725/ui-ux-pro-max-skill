import { detectLanguage, type Lang } from '@/lib/language'

/*
 * What the demo people say, and what "Translate" turns it into. The real app
 * sends member text to a model; the prototype looks it up here, so only the
 * lines below translate (anything you type gets a visible [demo] marker).
 */

/** English → Spanish, line for line with REPLIES_ES. */
export const REPLIES_EN = [
  'Haha, I love that.',
  'Saturday works for me. 8am?',
  'Perfect. I’ll bring water and a good playlist.',
  'Wait, really? Let’s do it.',
  'Send me your usual split and I’ll match it.',
  'Great. Where do you usually park?',
]
export const REPLIES_ES = [
  '¡Jaja, me encanta!',
  'El sábado me va perfecto. ¿A las 8?',
  'Perfecto. Llevo agua y buena música.',
  '¿En serio? ¡Vamos!',
  'Mándame tu rutina y la adapto.',
  'Genial. ¿Dónde sueles estacionar?',
]

/** Everything else the demo people write in Spanish, with its English. */
const ES_TO_EN: [string, string][] = [
  ['Me encantó tu respuesta sobre el día de pierna.', 'I loved your answer about leg day.'],
  ['¡Sí! Entreno a las 6 de la mañana, antes del trabajo.', 'Yes! I train at 6 in the morning, before work.'],
  ['¿Quieres entrenar juntos el sábado? Tengo un plan de piernas.', 'Want to train together on Saturday? I have a leg plan.'],
  ['Me encantó tu foto del maratón. ¿Corremos juntos algún día?', 'I loved your marathon photo. Should we run together someday?'],
  ['Corredora y fan del tamal de los domingos', 'Runner and fan of Sunday tamales'],
  ['En el sendero antes de las siete, con café en el termo.', 'On the trail before seven, with coffee in the thermos.'],
  ['Fútbol y gimnasio. Hablo español e inglés.', 'Soccer and the gym. I speak Spanish and English.'],
  ['El calentamiento no es opcional. Ni los sábados.', 'Warming up isn’t optional. Not even on Saturdays.'],
]

/** English lines that have a Spanish version, for when you set Translation to Español. */
const EN_TO_ES: [string, string][] = [
  ['Thank you! Do you train early?', '¡Gracias! ¿Entrenas temprano?'],
  ['Hey! Your swim pace in that photo is scary. Do you train at Barton Springs?', '¡Hola! Tu ritmo de natación en esa foto da miedo. ¿Entrenas en Barton Springs?'],
  ['Ha, thank you. Mostly Deep Eddy, sometimes Barton when it’s quiet.', 'Jaja, gracias. Sobre todo en Deep Eddy, a veces en Barton cuando está tranquilo.'],
  ['Deep Eddy at 6am is the best. Want to swim laps Saturday and get breakfast after?', 'Deep Eddy a las 6 de la mañana es lo mejor. ¿Nadamos unos largos el sábado y desayunamos después?'],
  ...REPLIES_EN.map((en, i) => [en, REPLIES_ES[i]] as [string, string]),
]

const norm = (s: string) => s.trim().replace(/\s+/g, ' ')
const toEn = new Map(ES_TO_EN.concat(REPLIES_ES.map((es, i) => [es, REPLIES_EN[i]] as [string, string])).map(([a, b]) => [norm(a), b]))
const toEs = new Map(EN_TO_ES.map(([a, b]) => [norm(a), b]))

export function translateDemo(text: string, target: Lang): { source: Lang | 'other'; text: string } {
  const source = detectLanguage(text) ?? 'other'
  const hit = (target === 'en' ? toEn : toEs).get(norm(text))
  if (hit) return { source: target === 'en' ? 'es' : 'en', text: hit }
  return { source, text: `[demo] ${text}` }
}

export const pick = <T>(list: T[], i: number): T => list[i % list.length]

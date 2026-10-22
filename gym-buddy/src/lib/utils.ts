export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/** Only allow same-site relative redirects (blocks `//evil.com` and `https://…`). */
export function safeNext(next: string | null | undefined, fallback = '/discover') {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}

/**
 * font-stretch that fits `text` on one line in Anybody (the display face):
 * `charsAtNormal` is how many characters fit at 100% width. Short text
 * stretches wide (up to 125%), long text condenses (down to 50%).
 */
export function fitStretch(text: string, charsAtNormal: number): string {
  const pct = Math.round((100 * charsAtNormal) / Math.max(text.length, 1))
  return `${Math.max(50, Math.min(125, pct))}%`
}

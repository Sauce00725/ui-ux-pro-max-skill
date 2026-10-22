export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/** Only allow same-site relative redirects (blocks `//evil.com` and `https://…`). */
export function safeNext(next: string | null | undefined, fallback = '/discover') {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}

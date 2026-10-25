import { bus } from '../bus'
import { useAppRouter } from '../router'

export const usePathname = () => useAppRouter().path
export const useSearchParams = () => useAppRouter().search

export function useRouter() {
  const r = useAppRouter()
  return {
    push: (to: string) => r.navigate(to),
    replace: (to: string) => r.navigate(to, { replace: true }),
    back: () => r.back(),
    forward: () => {},
    refresh: () => r.refresh(),
    prefetch: () => {},
  }
}

/** Only server code calls these; they are here so a stray import still resolves. */
export function redirect(to: string): never {
  bus.navigate(to)
  return undefined as never
}
export function notFound(): never {
  throw new Error('NEXT_NOT_FOUND')
}

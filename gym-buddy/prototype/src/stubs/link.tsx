import { useAppRouter } from '../router'

type Href = string | { pathname?: string; query?: Record<string, string | number | boolean | undefined> }

/** next/link, minus prefetching: a normal anchor whose click moves the prototype's router. */
export default function Link({
  href,
  replace,
  scroll: _scroll,
  prefetch: _prefetch,
  onClick,
  children,
  ...rest
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: Href
  replace?: boolean
  scroll?: boolean
  prefetch?: boolean | null
}) {
  const router = useAppRouter()
  const to =
    typeof href === 'string'
      ? href
      : (href.pathname ?? '/') +
        (href.query ? `?${new URLSearchParams(Object.entries(href.query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}` : '')
  const external = /^(https?:|mailto:|tel:)/.test(to)

  return (
    <a
      {...rest}
      href={to}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || external || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === '_blank') return
        e.preventDefault()
        router.navigate(to, { replace })
      }}
    >
      {children}
    </a>
  )
}

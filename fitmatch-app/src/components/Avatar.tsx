import { cn } from '@/lib/utils'

export function Avatar({ url, name, size = 'md', ring }: { url?: string; name: string; size?: 'sm' | 'md' | 'lg'; ring?: boolean }) {
  const dims = { sm: 'size-10', md: 'size-14', lg: 'size-20' }[size]
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={cn(dims, 'shrink-0 rounded-full object-cover', ring && 'ring-2 ring-primary ring-offset-2 ring-offset-bg')} />
  ) : (
    <span className={cn(dims, 'grid shrink-0 place-items-center rounded-full bg-muted font-display text-xl font-bold', ring && 'ring-2 ring-primary')}>
      {name[0]}
    </span>
  )
}

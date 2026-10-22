import { cn } from '@/lib/utils'
import { LoaderCircle } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'btn-holo',
  secondary: 'glass glass-flat text-fg hover:bg-(--glass-fill-hover)',
  ghost: 'text-muted-fg hover:text-fg hover:bg-(--glass-fill)',
  danger: 'bg-danger text-black hover:bg-red-400',
}

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 font-semibold transition-[color,background-color,box-shadow,transform,filter] duration-200',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

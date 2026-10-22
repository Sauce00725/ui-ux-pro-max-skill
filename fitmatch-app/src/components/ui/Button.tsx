import { cn } from '@/lib/utils'
import { LoaderCircle } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary shadow-[0_0_0_rgb(34_230_255/0)] hover:bg-primary-hover hover:shadow-[0_0_28px_rgb(34_230_255/0.45)]',
  secondary: 'bg-card text-fg border hover:bg-muted',
  ghost: 'text-muted-fg hover:text-fg hover:bg-card',
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
        'inline-flex h-12 items-center justify-center gap-2 rounded-panel px-5 font-semibold tracking-wide transition-[color,background-color,box-shadow] duration-200',
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

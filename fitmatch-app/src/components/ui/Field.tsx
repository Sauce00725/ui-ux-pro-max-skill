import { cn } from '@/lib/utils'

const inputBase =
  'w-full rounded-xl border bg-surface px-4 py-3 text-base text-fg placeholder:text-muted-fg/60 ' +
  'transition-colors focus:border-primary focus:outline-none aria-[invalid=true]:border-danger'

interface FieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  children?: React.ReactNode
}

/** Label + control + hint/error, wired up with aria-describedby. */
export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-muted-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-fg/80">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined
}

export function Input({
  id,
  error,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; error?: string; hint?: string }) {
  return (
    <input
      id={id}
      aria-invalid={!!error}
      aria-describedby={describedBy(id, error, hint)}
      className={cn(inputBase, className)}
      {...props}
    />
  )
}

export function Textarea({
  id,
  error,
  hint,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; error?: string; hint?: string }) {
  return (
    <textarea
      id={id}
      aria-invalid={!!error}
      aria-describedby={describedBy(id, error, hint)}
      className={cn(inputBase, 'min-h-24 resize-none', className)}
      {...props}
    />
  )
}

export function Select({
  id,
  error,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { id: string; error?: string }) {
  return (
    <select
      id={id}
      aria-invalid={!!error}
      aria-describedby={describedBy(id, error)}
      className={cn(inputBase, 'appearance-none', className)}
      {...props}
    >
      {children}
    </select>
  )
}

/** Toggleable pill used for multi-select tags (activities, times, genders). */
export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors duration-150',
        selected ? 'border-primary bg-primary text-on-primary' : 'bg-surface text-fg hover:border-muted-fg',
      )}
    >
      {children}
    </button>
  )
}

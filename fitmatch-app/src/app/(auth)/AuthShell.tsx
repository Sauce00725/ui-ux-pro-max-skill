import Link from 'next/link'
import { Dumbbell } from 'lucide-react'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 self-start font-display text-2xl font-bold uppercase tracking-wide">
        <span className="grid size-10 place-items-center rounded-xl bg-primary text-on-primary">
          <Dumbbell className="size-5" aria-hidden />
        </span>
        FitMatch
      </Link>
      <h1 className="font-display text-4xl font-bold uppercase leading-none">{title}</h1>
      <p className="mt-2 text-muted-fg">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </main>
  )
}

import Link from 'next/link'
import { Dumbbell } from 'lucide-react'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 self-start font-display text-2xl font-bold uppercase tracking-wide">
        <span className="grid size-10 place-items-center rounded-chip bg-primary text-on-primary shadow-[0_0_20px_rgb(34_230_255/0.5)]">
          <Dumbbell className="size-5" aria-hidden />
        </span>
        FitMatch
      </Link>
      <p className="hud-label text-primary">// access terminal</p>
      <h1 className="mt-2 font-display text-3xl font-black uppercase leading-none [text-shadow:0_0_24px_rgb(34_230_255/0.35)]">{title}</h1>
      <p className="mt-2 text-muted-fg">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </main>
  )
}

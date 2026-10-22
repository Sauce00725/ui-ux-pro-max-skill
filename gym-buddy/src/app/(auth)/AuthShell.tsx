import Link from 'next/link'
import { Logo } from '@/components/Logo'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 self-start" aria-label="Gym Buddy home">
        <Logo size="md" />
      </Link>
      <p className="hud-label text-primary">// access terminal</p>
      <h1 className="mt-2 font-display text-3xl font-black uppercase leading-none">{title}</h1>
      <p className="mt-2 text-muted-fg">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </main>
  )
}

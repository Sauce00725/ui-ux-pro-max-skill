import { CalendarDays } from 'lucide-react'

export const metadata = { title: 'Events · FitMatch' }

// Phase 2 of the roadmap: events table + map/list + organizer submissions.
export default function EventsPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col items-center px-4 py-20 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-card text-primary">
        <CalendarDays className="size-8" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold uppercase">Local events</h1>
      <p className="mt-2 text-muted-fg">
        Run clubs, CrossFit throwdowns, pickleball open play and more near you. Coming soon.
      </p>
    </main>
  )
}

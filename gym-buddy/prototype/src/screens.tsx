import { Suspense } from 'react'
import { AuthShell } from '@/app/(auth)/AuthShell'
import { LoginForm } from '@/app/(auth)/login/LoginForm'
import { SignupForm } from '@/app/(auth)/signup/SignupForm'
import AppTemplate from '@/app/(app)/template'
import { BottomNav } from '@/components/BottomNav'
import { TopBar } from '@/components/TopBar'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { DailyDeck } from '@/components/deck/DailyDeck'
import { EventDetailView } from '@/components/events/EventDetailView'
import { EventNewView } from '@/components/events/EventNewView'
import { EventsView, type EventFilters } from '@/components/events/EventsView'
import { Landing } from '@/components/landing/Landing'
import { LikesView } from '@/components/likes/LikesView'
import { MatchesView } from '@/components/matches/MatchesView'
import { SettingsForm } from '@/components/settings/SettingsForm'
import type { AppMode } from '@/lib/types'
import { EVENT_RADII, EVENT_WHEN, type EventWhen, type GOALS, type PromptKey } from '@/lib/validation'
import { photo } from './demo/art'
import { ACTIVITIES } from './demo/events'
import { ME } from './demo/people'
import * as world from './demo/world'
import { useAppRouter } from './router'

/*
 * The prototype's route table. Each screen does what the matching Next page
 * does (read data, hand it to the same view component), except the data comes
 * from the demo world instead of Supabase. The app screens sit in the same
 * frame as src/app/(app)/layout.tsx: top bar, page-enter template, dock.
 */

function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-(--dock-clearance)">
      <TopBar />
      <AppTemplate>{children}</AppTemplate>
      <Suspense>
        <BottomNav />
      </Suspense>
    </div>
  )
}

function parseFilters(p: URLSearchParams): EventFilters {
  const when = p.get('when')
  const radius = EVENT_RADII.find((r) => String(r) === p.get('radius')) ?? 25
  return {
    when: when && when in EVENT_WHEN ? (when as EventWhen) : 'week',
    radius,
    activity: p.get('activity') || null,
    beginner: p.get('beginner') === '1',
  }
}

const myPhoto = (i: number) => photo(ME.art[i].seed, ME.art[i].motif, ME.art[i].mood)

function settingsFor() {
  const everyone = ['woman', 'man', 'nonbinary'] as const
  const ids = ACTIVITIES.filter((a) => ME.activities.includes(a.name)).map((a) => a.id)
  return {
    basics: {
      displayName: ME.name,
      birthdate: '1995-04-12',
      gender: 'nonbinary' as const,
      bio: 'Early runs, heavy-ish lifts, slow brunches.',
      city: 'Austin',
      state: 'TX',
      lat: null,
      lng: null,
    },
    fitness: {
      activityIds: ids,
      fitnessLevel: 3,
      trainingTimes: ['early_morning', 'weekends'] as ('early_morning' | 'weekends')[],
      goals: ME.goals as (typeof GOALS)[number][],
      helpsBeginners: true,
    },
    modes: {
      buddy: { enabled: true, headline: 'Saturday long-run crew, all paces', minAge: 21, maxAge: 55, maxDistanceMi: 25, interestedIn: [...everyone], intent: null },
      dating: { enabled: true, headline: 'Trail miles, then tacos', minAge: 25, maxAge: 40, maxDistanceMi: 25, interestedIn: [...everyone], intent: ME.intent },
    },
    prompts: ME.prompts.map((p) => ({ key: p.key as PromptKey, answer: p.answer })),
    photos: ME.art.map((_, i) => ({ path: `${world.MY_ID}/${i}.jpg`, previewUrl: myPhoto(i) })),
  }
}

function Missing({ what }: { what: string }) {
  return (
    <main className="mx-auto max-w-md px-(--space-gutter) pt-10 text-center">
      <h1 className="font-display text-title font-bold uppercase">Not here any more</h1>
      <p className="mt-2 text-muted-fg">{what} isn’t in this prototype. Reset the demo from the Prototype guide to bring everything back.</p>
    </main>
  )
}

export function Screen() {
  const { path, search, generation } = useAppRouter()
  const mode: AppMode = search.get('mode') === 'dating' ? 'dating' : 'buddy'

  // ── Before you're in ──────────────────────────────────────────────────────
  if (path === '/') return <Landing key={generation} />
  if (path === '/login') {
    return (
      <AuthShell title="Welcome back" subtitle="Your matches, training partners and events are waiting.">
        <LoginForm />
      </AuthShell>
    )
  }
  if (path === '/signup') {
    return (
      <AuthShell title="Find your people" subtitle="Dates, training partners and local events for every body and every level.">
        <SignupForm />
      </AuthShell>
    )
  }

  // ── The app ───────────────────────────────────────────────────────────────
  let screen: React.ReactNode
  if (path === '/discover') {
    const { cards, quota, superQuota } = world.selection(mode)
    screen = (
      <DailyDeck
        key={`${mode}-${generation}`}
        mode={mode}
        initialCards={cards}
        initialQuota={quota}
        initialSuperQuota={superQuota}
        selfPhoto={myPhoto(0)}
      />
    )
  } else if (path === '/likes') {
    const likesMode: AppMode = search.get('mode') === 'buddy' ? 'buddy' : 'dating'
    screen = <LikesView mode={likesMode} likes={world.likes(likesMode)} />
  } else if (path === '/events') {
    const filters = parseFilters(search)
    const activities = [...ACTIVITIES].sort((a, b) => a.name.localeCompare(b.name)).map(({ slug, name }) => ({ slug, name }))
    screen = <EventsView filters={filters} events={world.events(filters)} activities={activities} />
  } else if (path === '/events/new') {
    const activities = [...ACTIVITIES].sort((a, b) => a.name.localeCompare(b.name)).map(({ slug, name }) => ({ slug, name }))
    screen = <EventNewView activities={activities} defaultCity="Austin" defaultState="TX" />
  } else if (path.startsWith('/events/')) {
    const id = path.split('/')[2]
    const event = world.event(id)
    screen = event ? <EventDetailView key={id} event={event} attendees={world.attendees(id)} /> : <Missing what="That event" />
  } else if (path === '/matches') {
    screen = <MatchesView rows={world.matchRows()} avatars={world.avatars()} currentUserId={world.MY_ID} />
  } else if (path.startsWith('/matches/')) {
    const id = path.split('/')[2]
    const c = world.chat(id)
    screen = c ? (
      <ChatWindow
        key={`${id}-${generation}`}
        matchId={c.matchId}
        mode={c.mode}
        currentUserId={world.MY_ID}
        other={c.other}
        initialMessages={c.messages}
        initialHasMore={false}
        contextPhotos={c.contextPhotos}
        events={c.events}
      />
    ) : (
      <Missing what="That chat" />
    )
  } else if (path === '/settings') {
    screen = (
      <SettingsForm
        key={generation}
        userId={world.MY_ID}
        email={ME.email}
        activities={ACTIVITIES.map(({ id, name }) => ({ id, name }))}
        paused={world.isPaused()}
        pendingPhotos={0}
        initial={settingsFor()}
      />
    )
  } else {
    screen = <Missing what="That page" />
  }

  return <AppFrame>{screen}</AppFrame>
}

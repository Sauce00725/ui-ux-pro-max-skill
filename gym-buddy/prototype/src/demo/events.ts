import type { EventItem } from '@/lib/types'

/*
 * Events around Austin, dated relative to when the prototype opens so the
 * Events tab always has a "Tomorrow" and a "This weekend". Modelled on
 * supabase/seed.sql.
 */

export const ACTIVITIES = [
  { id: 1, slug: 'lifting', name: 'Weightlifting' }, { id: 2, slug: 'running', name: 'Running' },
  { id: 3, slug: 'crossfit', name: 'CrossFit' }, { id: 4, slug: 'pickleball', name: 'Pickleball' },
  { id: 5, slug: 'cycling', name: 'Cycling' }, { id: 6, slug: 'yoga', name: 'Yoga' },
  { id: 7, slug: 'hiking', name: 'Hiking' }, { id: 8, slug: 'climbing', name: 'Climbing' },
  { id: 9, slug: 'swimming', name: 'Swimming' }, { id: 10, slug: 'boxing', name: 'Boxing / MMA' },
  { id: 11, slug: 'tennis', name: 'Tennis' }, { id: 12, slug: 'hyrox', name: 'HYROX' },
  { id: 13, slug: 'pilates', name: 'Pilates' }, { id: 14, slug: 'basketball', name: 'Basketball' },
  { id: 15, slug: 'triathlon', name: 'Triathlon' }, { id: 16, slug: 'walking', name: 'Walking' },
  { id: 17, slug: 'home_workouts', name: 'Home workouts' }, { id: 18, slug: 'dance_fitness', name: 'Dance fitness' },
  { id: 19, slug: 'beginner_gym', name: 'Learning the gym' },
]

interface Seed {
  key: string
  title: string
  slug: string
  days: number
  at: string // local HH:MM
  mins: number
  venue: string
  address: string | null
  beginner: boolean
  cost: number
  cap: number | null
  going: number
  buddies?: number
  distance: number
  descr: string
}

const SEEDS: Seed[] = [
  { key: 'e1', title: 'Sunrise 5K Social Run', slug: 'running', days: 1, at: '06:30', mins: 60, venue: 'Lady Bird Lake Trail', address: 'Auditorium Shores trailhead', beginner: true, cost: 0, cap: null, going: 27, buddies: 2, distance: 2.4, descr: 'All paces, no one gets dropped. Coffee after.' },
  { key: 'e2', title: 'Beginner Pickleball Open Play', slug: 'pickleball', days: 2, at: '18:00', mins: 120, venue: 'Community Rec Center Courts', address: null, beginner: true, cost: 500, cap: 24, going: 21, distance: 4.1, descr: 'Paddles to borrow. We rotate partners every game.' },
  { key: 'e3', title: 'Partner WOD Saturday', slug: 'crossfit', days: 4, at: '09:00', mins: 75, venue: 'Eastside Strength Box', address: null, beginner: false, cost: 1500, cap: 30, going: 18, buddies: 1, distance: 5.6, descr: 'Bring a buddy or get paired up. Scaled options for every movement.' },
  { key: 'e4', title: 'Walk & Talk: Learn the Gym Basics', slug: 'beginner_gym', days: 3, at: '17:30', mins: 60, venue: 'Downtown Fitness Hub', address: null, beginner: true, cost: 0, cap: 15, going: 11, distance: 3.2, descr: 'A coach walks you through machines, free weights and a starter plan.' },
  { key: 'e5', title: 'Sunrise Yoga on the Lawn', slug: 'yoga', days: 3, at: '06:45', mins: 60, venue: 'Butler Park Lawn', address: 'Near the Pioneer Farms entrance', beginner: true, cost: 0, cap: null, going: 34, distance: 2.9, descr: 'Slow flow for every body. Bring a mat; a few spares on hand.' },
  { key: 'e6', title: 'Climbing Social: Bouldering Night', slug: 'climbing', days: 2, at: '19:30', mins: 120, venue: 'Austin Boulder Collective', address: null, beginner: true, cost: 1200, cap: 25, going: 16, buddies: 1, distance: 6.8, descr: 'First-timers welcome. Shoe rental is discounted for the group.' },
  { key: 'e7', title: 'Beginner Barbell Basics', slug: 'lifting', days: 5, at: '17:30', mins: 75, venue: 'Iron Works Gym', address: 'East Austin', beginner: true, cost: 0, cap: 12, going: 9, distance: 3.7, descr: 'Squat, hinge, press: learn the cues with empty bars and friendly spotters.' },
  { key: 'e8', title: 'Lake Loop Group Ride', slug: 'cycling', days: 6, at: '07:00', mins: 120, venue: 'Lady Bird Lake, Congress Ave Bridge', address: null, beginner: false, cost: 0, cap: null, going: 22, distance: 2.1, descr: 'No-drop 22 miles at a conversational pace. Helmets required.' },
  { key: 'e9', title: 'Lunchtime HIIT in the Park', slug: 'crossfit', days: 0, at: '12:15', mins: 40, venue: 'Pease Park', address: 'By the playground', beginner: false, cost: 0, cap: null, going: 14, distance: 3.9, descr: 'Four rounds, one timer, zero equipment.' },
]

const slugName = (slug: string) => ACTIVITIES.find((a) => a.slug === slug)?.name ?? null

function at(days: number, hhmm: string): Date {
  const d = new Date()
  const [h, m] = hhmm.split(':').map(Number)
  d.setDate(d.getDate() + days)
  d.setHours(h, m, 0, 0)
  return d
}

export function seedEvents(): EventItem[] {
  return SEEDS.map((s) => {
    const start = at(s.days, s.at)
    return {
      id: s.key,
      title: s.title,
      description: s.descr,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + s.mins * 60_000).toISOString(),
      venueName: s.venue,
      address: s.address,
      city: 'Austin',
      state: 'TX',
      url: null,
      beginnerFriendly: s.beginner,
      costCents: s.cost,
      capacity: s.cap,
      activitySlug: s.slug,
      activityName: slugName(s.slug),
      distanceMi: s.distance,
      goingCount: s.going,
      buddiesGoing: s.buddies ?? 0,
      iAmGoing: false,
      myShowMe: false,
      isMine: false,
      moderation: 'approved',
      organizerName: null,
    } satisfies EventItem
  })
}

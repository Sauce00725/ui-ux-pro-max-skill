import type { EventFilters } from '@/components/events/EventsView'
import type { MatchRow } from '@/components/matches/MatchesView'
import type {
  AppMode,
  ChatMessage,
  DiscoveryCard,
  EventAttendee,
  EventItem,
  LikeExtras,
  LikeReceived,
  Selection,
  SuperQuota,
  SwipeQuota,
  SwipeResult,
} from '@/lib/types'
import { intentsAlign } from '@/lib/validation'
import { bus } from '../bus'
import { photo } from './art'
import { ACTIVITIES, seedEvents } from './events'
import { ADMIRERS, BUDDIES, DATING, MATCHED, ME, type Admirer, type Person } from './people'
import { pick, REPLIES_EN, REPLIES_ES } from './replies'

/*
 * The demo world: an in-memory stand-in for everything the real app keeps in
 * Supabase (swipes, quotas, matches, messages, RSVPs). The stubbed server
 * actions and the fake Supabase client both read and write this one object, so
 * the real components behave as they would against the real backend.
 * Everything resets when the page reloads (or from the Demo tools).
 */

export const LIMIT = 10
const WINDOW_MS = 6 * 3600_000
const SUPER_WINDOW_MS = 24 * 3600_000
export const MY_ID = ME.id

type MessageRow = Omit<ChatMessage, 'status'>
export type Listener = { type: string; filter: { event?: string }; cb: (payload: unknown) => void }

interface MatchRec {
  id: string
  mode: AppMode
  person: Person
  createdAt: number
  lastMessageAt: number | null
}

interface State {
  quota: Record<AppMode, { used: number; resetsAt: number | null }>
  superAt: number | null
  seen: Record<AppMode, Set<string>>
  admirers: Record<AppMode, Admirer[]>
  matches: MatchRec[]
  messages: Map<string, MessageRow[]>
  nextId: number
  nextMatch: number
  rsvps: Map<string, { going: boolean; showMe: boolean }>
  events: EventItem[]
  /** Demo tool: whether the next like becomes a match whoever it is. */
  nextMatches: boolean
  paused: boolean
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const myPhoto = (i: number) => photo(ME.art[i].seed, ME.art[i].motif, ME.art[i].mood)
const personPhoto = (p: Person, i: number) => photo(p.art[i].seed, p.art[i].motif, p.art[i].mood)

/** What the two seeded conversations say. `ago` is minutes before the prototype opened. */
const HISTORY: Record<string, { from: 'me' | 'them'; body: string; ago: number; kind?: 'like_comment'; context?: MessageRow['context'] }[]> = {
  'm-andre': [
    { from: 'them', body: 'Hey! Your swim pace in that photo is scary. Do you train at Barton Springs?', ago: 2880 },
    { from: 'me', body: 'Ha, thank you. Mostly Deep Eddy, sometimes Barton when it’s quiet.', ago: 2850 },
    { from: 'them', body: 'Deep Eddy at 6am is the best. Want to swim laps Saturday and get breakfast after?', ago: 2840 },
  ],
  'm-marisol': [
    { from: 'them', kind: 'like_comment', body: 'Me encantó tu respuesta sobre el día de pierna.', ago: 4300, context: { prompt_key: 'leg_day', prompt_answer: ME.prompts[0].answer } },
    { from: 'me', body: 'Thank you! Do you train early?', ago: 4200 },
    { from: 'them', body: '¡Sí! Entreno a las 6 de la mañana, antes del trabajo.', ago: 4190 },
    { from: 'them', body: '¿Quieres entrenar juntos el sábado? Tengo un plan de piernas.', ago: 4189 },
  ],
}

let s: State
fresh()

function fresh(): State {
  const st: State = {
    quota: { dating: { used: 0, resetsAt: null }, buddy: { used: 0, resetsAt: null } },
    superAt: null,
    seen: { dating: new Set(), buddy: new Set() },
    admirers: { dating: [...ADMIRERS.dating], buddy: [...ADMIRERS.buddy] },
    matches: [],
    messages: new Map(),
    nextId: 1,
    nextMatch: 1,
    rsvps: new Map(),
    events: seedEvents(),
    nextMatches: false,
    paused: false,
  }
  s = st
  for (const { mode, person, startedAgoMin } of MATCHED) {
    const m: MatchRec = { id: `m${st.nextMatch++}`, mode, person, createdAt: Date.now() - startedAgoMin * 60_000, lastMessageAt: null }
    st.matches.push(m)
    st.seen[mode].add(person.id)
    for (const line of HISTORY[person.id] ?? []) {
      addMessage(m.id, {
        sender_id: line.from === 'me' ? MY_ID : person.id,
        body: line.body,
        kind: line.kind,
        context: line.context,
        created_at: ago(line.ago),
        read_at: line.from === 'me' ? ago(line.ago - 5) : null,
      })
    }
  }
  return st
}

function addMessage(matchId: string, m: Partial<MessageRow> & { sender_id: string; body: string }): MessageRow {
  const row: MessageRow = {
    id: s.nextId++,
    client_id: m.client_id ?? crypto.randomUUID(),
    match_id: matchId,
    sender_id: m.sender_id,
    body: m.body,
    created_at: m.created_at ?? new Date().toISOString(),
    read_at: m.read_at ?? null,
    kind: m.kind ?? 'text',
    context: m.context ?? null,
  }
  const list = s.messages.get(matchId) ?? []
  list.push(row)
  s.messages.set(matchId, list)
  const match = s.matches.find((x) => x.id === matchId)
  if (match) match.lastMessageAt = Date.parse(row.created_at)
  return row
}

/* ─── Quotas ─────────────────────────────────────────────────────────────── */

function quotaOf(mode: AppMode): SwipeQuota {
  const q = s.quota[mode]
  if (q.resetsAt && Date.now() >= q.resetsAt) {
    q.used = 0
    q.resetsAt = null
    recycle(mode)
  }
  return {
    remaining: Math.max(0, LIMIT - q.used),
    limit: LIMIT,
    windowSeconds: WINDOW_MS / 1000,
    resetsAt: q.resetsAt ? new Date(q.resetsAt).toISOString() : null,
  }
}

function superOf(): SuperQuota {
  if (s.superAt && Date.now() - s.superAt >= SUPER_WINDOW_MS) s.superAt = null
  return { remaining: s.superAt ? 0 : 1, resetsAt: s.superAt ? new Date(s.superAt + SUPER_WINDOW_MS).toISOString() : null }
}

/** A new window deals the same twelve again (the demo has no more people), minus the ones you matched. */
function recycle(mode: AppMode) {
  s.seen[mode] = new Set(s.matches.filter((m) => m.mode === mode).map((m) => m.person.id))
}

function spend(mode: AppMode) {
  const q = s.quota[mode]
  q.used += 1
  q.resetsAt ??= Date.now() + WINDOW_MS
}

/* ─── Cards ──────────────────────────────────────────────────────────────── */

function toCard(p: Person): DiscoveryCard {
  const mine = new Set(ME.activities)
  const mineGoals = new Set(ME.goals)
  return {
    id: p.id,
    name: p.name,
    age: p.age,
    city: p.city,
    state: p.state,
    bio: p.bio ?? null,
    headline: p.headline,
    fitnessLevel: p.level,
    trainingTimes: p.times,
    isVerified: !!p.verified,
    distanceMi: p.distance,
    sharedActivities: p.activities.filter((a) => mine.has(a)),
    otherActivities: p.activities.filter((a) => !mine.has(a)),
    photos: p.art.map((_, i) => personPhoto(p, i)),
    goals: p.goals,
    sharedGoals: p.goals.filter((g) => mineGoals.has(g)),
    helpsBeginners: !!p.helps,
    photoIds: p.art.map((_, i) => `${p.id}-ph${i}`),
    prompts: p.prompts.map((x, i) => ({ id: `${p.id}-pr${i}`, key: x.key, answer: x.answer })),
    superLikedMe: !!p.superLikedMe,
    intent: p.intent ?? null,
    intentAligned: intentsAlign(p.intent, ME.intent),
  }
}

const deckOf = (mode: AppMode) => (mode === 'dating' ? DATING : BUDDIES)

export function selection(mode: AppMode): Selection {
  const quota = quotaOf(mode)
  const cards = quota.remaining > 0 ? deckOf(mode).filter((p) => !s.seen[mode].has(p.id)).slice(0, LIMIT).map(toCard) : []
  return { cards, quota, superQuota: superOf() }
}

export function likes(mode: AppMode): LikeReceived[] {
  return s.admirers[mode].map((a) => {
    const liked = a.liked
    return {
      ...toCard({ ...a, superLikedMe: a.isSuper }),
      likedAt: ago(a.likedAgoMin),
      isSuper: a.isSuper,
      comment: a.comment,
      likedPhotoUrl: liked?.kind === 'photo' ? myPhoto(liked.index) : null,
      likedPrompt: liked?.kind === 'prompt' ? { key: liked.key, answer: ME.prompts.find((p) => p.key === liked.key)?.answer ?? '' } : null,
    }
  })
}

/* ─── Swipes and matches ─────────────────────────────────────────────────── */

type SwipeInput = { targetId: string; mode: AppMode; action: 'like' | 'pass'; super?: boolean } & LikeExtras

export async function swipe(raw: unknown): Promise<SwipeResult> {
  const input = raw as SwipeInput
  await wait(180 + Math.random() * 220)
  const { mode } = input
  const admirer = s.admirers[mode].find((a) => a.id === input.targetId)
  const person = admirer ?? deckOf(mode).find((p) => p.id === input.targetId)
  if (!person) return { ok: false, reason: 'error', message: 'That profile isn’t available any more.' }

  // Answering someone who liked you first is free; it never spends a pick.
  if (!admirer) {
    const q = quotaOf(mode)
    if (q.remaining === 0) {
      return { ok: false, reason: 'limit', message: 'You’re out of picks for now. They refill soon.', quota: q, superQuota: superOf() }
    }
    if (input.super && superOf().remaining === 0) {
      return { ok: false, reason: 'super-limit', message: 'You’ve used today’s Super Like.', quota: q, superQuota: superOf() }
    }
    spend(mode)
  }
  if (input.super && superOf().remaining > 0) s.superAt = Date.now()

  s.seen[mode].add(person.id)
  if (admirer) s.admirers[mode] = s.admirers[mode].filter((a) => a.id !== admirer.id)

  let matchId: string | null = null
  if (input.action === 'like' && (admirer || person.likesMe || s.nextMatches)) {
    matchId = createMatch(mode, person, input, admirer)
  }
  return { ok: true, matchId, quota: quotaOf(mode), superQuota: superOf() }
}

function createMatch(mode: AppMode, person: Person, input: SwipeInput, admirer?: Admirer): string {
  const m: MatchRec = { id: `m${s.nextMatch++}`, mode, person, createdAt: Date.now(), lastMessageAt: null }
  s.matches.push(m)

  // Like comments become the first messages, the way the match trigger does it.
  if (admirer?.comment) {
    const liked = admirer.liked
    addMessage(m.id, {
      sender_id: person.id,
      body: admirer.comment,
      kind: 'like_comment',
      created_at: ago(admirer.likedAgoMin),
      context:
        liked?.kind === 'photo'
          ? { photo_id: `me-ph${liked.index}`, super: admirer.isSuper }
          : liked?.kind === 'prompt'
            ? { prompt_key: liked.key, prompt_answer: ME.prompts.find((p) => p.key === liked.key)?.answer, super: admirer.isSuper }
            : { super: admirer.isSuper },
    })
  }
  if (input.comment) {
    const promptIndex = input.promptId ? Number(input.promptId.split('-pr')[1]) : -1
    const prompt = promptIndex >= 0 ? person.prompts[promptIndex] : undefined
    addMessage(m.id, {
      sender_id: MY_ID,
      body: input.comment,
      kind: 'like_comment',
      context: input.photoId
        ? { photo_id: input.photoId, super: input.super }
        : prompt
          ? { prompt_key: prompt.key, prompt_answer: prompt.answer, super: input.super }
          : { super: input.super },
    })
  }
  return m.id
}

/* ─── Chats ──────────────────────────────────────────────────────────────── */

export function matchRows(): MatchRow[] {
  return s.matches
    .map((m) => {
      // What touch_match() keeps on the match: the latest message's sender and its first 140 characters.
      const last = [...(s.messages.get(m.id) ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      return {
        id: m.id,
        mode: m.mode,
        last_message_at: m.lastMessageAt ? new Date(m.lastMessageAt).toISOString() : null,
        last_sender_id: last?.sender_id ?? null,
        last_message_preview: last?.body.trim().slice(0, 140) || null,
        other: { id: m.person.id, display_name: m.person.name },
        sort: m.lastMessageAt ?? Infinity, // new matches (no messages yet) first, like the real query
      }
    })
    .sort((a, b) => b.sort - a.sort)
    .map(({ sort: _sort, ...row }) => row)
}

export function avatars(): Record<string, string | undefined> {
  return Object.fromEntries(s.matches.map((m) => [m.person.id, personPhoto(m.person, 0)]))
}

export function chat(matchId: string) {
  const m = s.matches.find((x) => x.id === matchId)
  if (!m) return null
  const contextPhotos: Record<string, string> = {}
  ME.art.forEach((_, i) => (contextPhotos[`me-ph${i}`] = myPhoto(i)))
  m.person.art.forEach((_, i) => (contextPhotos[`${m.person.id}-ph${i}`] = personPhoto(m.person, i)))
  const shared = m.person.activities.filter((a) => ME.activities.includes(a)).sort()
  const upcoming = events({ when: 'week', radius: 25, activity: null, beginner: false })
  const fitting = upcoming.filter((e) => e.activityName && shared.includes(e.activityName))
  return {
    matchId: m.id,
    mode: m.mode,
    other: {
      name: m.person.name,
      avatarUrl: personPhoto(m.person, 0),
      prompts: m.person.prompts.map((p) => ({ key: p.key, answer: p.answer })),
      sharedActivities: shared,
    },
    events: (fitting.length ? fitting : upcoming.filter((e) => e.beginnerFriendly)).slice(0, 3),
    messages: [...(s.messages.get(m.id) ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    contextPhotos,
  }
}

export function unmatch(matchId: string) {
  s.matches = s.matches.filter((m) => m.id !== matchId)
}

/* ─── Realtime (what Supabase Realtime would deliver) ────────────────────── */

const listeners = new Map<string, Set<Listener[]>>()
const replyTimers = new Map<string, number[]>()
const replyCount = new Map<string, number>()

export function attach(matchId: string, handlers: Listener[]) {
  const set = listeners.get(matchId) ?? new Set()
  set.add(handlers)
  listeners.set(matchId, set)
}

export function detach(matchId: string, handlers: Listener[]) {
  listeners.get(matchId)?.delete(handlers)
}

function emit(matchId: string, type: 'postgres_changes' | 'broadcast', event: string, payload: unknown) {
  for (const handlers of listeners.get(matchId) ?? []) {
    for (const l of handlers) if (l.type === type && l.filter?.event === event) l.cb(payload)
  }
}

/** A message sent from the chat window: stored, echoed back, and answered a moment later. */
export function insertMessage(input: { client_id: string; match_id: string; sender_id: string; body: string }): MessageRow {
  const row = addMessage(input.match_id, input)
  setTimeout(() => emit(input.match_id, 'postgres_changes', 'INSERT', { new: row }), 30)
  scheduleReply(input.match_id)
  return row
}

export function olderMessages(matchId: string, before: string, limit: number): MessageRow[] {
  return (s.messages.get(matchId) ?? [])
    .filter((m) => m.created_at < before)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
}

function scheduleReply(matchId: string) {
  for (const t of replyTimers.get(matchId) ?? []) clearTimeout(t)
  const match = s.matches.find((m) => m.id === matchId)
  if (!match) return
  const typing = window.setTimeout(() => emit(matchId, 'broadcast', 'typing', { payload: { userId: match.person.id } }), 900)
  const reply = window.setTimeout(() => {
    const n = replyCount.get(matchId) ?? 0
    replyCount.set(matchId, n + 1)
    // They read what you sent…
    for (const m of s.messages.get(matchId) ?? []) {
      if (m.sender_id === MY_ID && !m.read_at) {
        m.read_at = new Date().toISOString()
        emit(matchId, 'postgres_changes', 'UPDATE', { new: m })
      }
    }
    // …and answer.
    const row = addMessage(matchId, { sender_id: match.person.id, body: pick(match.person.spanish ? REPLIES_ES : REPLIES_EN, n) })
    emit(matchId, 'postgres_changes', 'INSERT', { new: row })
  }, 2600)
  replyTimers.set(matchId, [typing, reply])
}

export function markRead(matchId: string) {
  for (const m of s.messages.get(matchId) ?? []) if (m.sender_id !== MY_ID && !m.read_at) m.read_at = new Date().toISOString()
}

/* ─── Events ─────────────────────────────────────────────────────────────── */

function withRsvp(e: EventItem): EventItem {
  const r = s.rsvps.get(e.id)
  if (!r) return e
  return { ...e, iAmGoing: r.going, myShowMe: r.showMe, goingCount: e.goingCount + (r.going ? 1 : 0) }
}

function inWindow(startsAt: string, when: EventFilters['when']): boolean {
  const t = Date.parse(startsAt)
  const now = Date.now()
  if (t < now - 3600_000) return false
  if (when === 'month') return t <= now + 30 * 86_400_000
  if (when === 'week') return t <= now + 7 * 86_400_000
  // "This weekend": the coming Saturday and Sunday (or what's left of them if it's already the weekend).
  const d = new Date()
  const toSat = (6 - d.getDay() + 7) % 7
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (d.getDay() === 0 ? 0 : toSat))
  if (d.getDay() === 0) start.setDate(start.getDate() - 1)
  const end = new Date(start.getTime() + 2 * 86_400_000)
  return t >= start.getTime() && t < end.getTime()
}

export function events(f: EventFilters): EventItem[] {
  return s.events
    .map(withRsvp)
    .filter((e) => (e.distanceMi ?? 0) <= f.radius)
    .filter((e) => inWindow(e.startsAt, f.when))
    .filter((e) => !f.activity || e.activitySlug === f.activity)
    .filter((e) => !f.beginner || e.beginnerFriendly)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export const event = (id: string) => {
  const e = s.events.find((x) => x.id === id)
  return e ? withRsvp(e) : null
}

export function attendees(id: string): EventAttendee[] {
  const e = event(id)
  if (!e) return []
  const matched = new Set(s.matches.map((m) => m.person.id))
  const crowd = [...BUDDIES, ...DATING].filter((_, i) => (i + id.length) % 4 === 0).slice(0, 5)
  const list: EventAttendee[] = crowd.map((p) => ({ id: p.id, name: p.name, photoUrl: personPhoto(p, 0), isMatch: matched.has(p.id) }))
  if (e.iAmGoing && e.myShowMe) list.unshift({ id: MY_ID, name: `${ME.name} (you)`, photoUrl: myPhoto(0), isMatch: false })
  return list
}

export function setRsvp(eventId: string, going: boolean, showMe: boolean) {
  s.rsvps.set(eventId, { going, showMe: going ? showMe : false })
}

export function addEvent(v: {
  title: string
  activitySlug: string | null
  startsAt: string
  endsAt: string
  venueName: string
  address: string
  city: string
  state: string
  url: string
  beginnerFriendly: boolean
  costDollars: number
  capacity: number | null
  description: string
}): string {
  const id = `ev${s.events.length + 1}`
  s.events.push({
    id,
    title: v.title,
    description: v.description || null,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    venueName: v.venueName,
    address: v.address || null,
    city: v.city,
    state: v.state,
    url: v.url || null,
    beginnerFriendly: v.beginnerFriendly,
    costCents: Math.round(v.costDollars * 100),
    capacity: v.capacity,
    activitySlug: v.activitySlug,
    activityName: ACTIVITIES.find((a) => a.slug === v.activitySlug)?.name ?? null,
    distanceMi: 1.2,
    goingCount: 0,
    buddiesGoing: 0,
    iAmGoing: false,
    myShowMe: false,
    isMine: true,
    moderation: 'pending',
    organizerName: ME.name,
  })
  return id
}

export function cancelEvent(id: string) {
  s.events = s.events.filter((e) => e.id !== id)
}

/* ─── Profile ────────────────────────────────────────────────────────────── */

export const isPaused = () => s.paused
export const setPaused = (paused: boolean) => (s.paused = paused)

/* ─── Demo tools ─────────────────────────────────────────────────────────── */

export const tools = {
  reset() {
    for (const list of replyTimers.values()) for (const t of list) clearTimeout(t)
    replyTimers.clear()
    replyCount.clear()
    fresh()
    bus.remount()
  },
  picksLeft(n: number) {
    for (const mode of ['dating', 'buddy'] as const) {
      const q = s.quota[mode]
      q.used = LIMIT - n
      q.resetsAt ??= Date.now() + WINDOW_MS
    }
    bus.remount()
  },
  /** Fast-forward the 6-hour refill: fresh picks, a fresh Super Like. */
  skipWait() {
    for (const mode of ['dating', 'buddy'] as const) {
      s.quota[mode] = { used: 0, resetsAt: null }
      recycle(mode)
    }
    s.superAt = null
    bus.remount()
  },
  get nextMatches() {
    return s.nextMatches
  },
  setNextMatches(on: boolean) {
    s.nextMatches = on
    bus.remount()
  },
}

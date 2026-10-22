export type AppMode = 'dating' | 'buddy'

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

export interface DiscoveryCard {
  id: string
  name: string
  age: number
  city: string | null
  state: string | null
  bio: string | null
  headline: string | null
  fitnessLevel: number | null
  trainingTimes: string[]
  isVerified: boolean
  distanceMi: number
  sharedActivities: string[]
  otherActivities: string[]
  photos: string[]
  goals: string[]
  sharedGoals: string[]
  helpsBeginners: boolean
}

export interface ChatMessage {
  id: number | null // null until the server confirms the insert
  client_id: string
  match_id: string
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
  status: 'sending' | 'sent' | 'failed'
}

/** Slow-dating allowance for one mode. `resetsAt` is null until the first swipe opens a window. */
export interface SwipeQuota {
  remaining: number
  limit: number
  windowSeconds: number
  resetsAt: string | null
}

export type SwipeResult =
  | { ok: true; matchId: string | null; quota: SwipeQuota }
  | { ok: false; reason: 'limit' | 'error'; message: string; quota?: SwipeQuota }

export interface Selection {
  cards: DiscoveryCard[]
  quota: SwipeQuota
}

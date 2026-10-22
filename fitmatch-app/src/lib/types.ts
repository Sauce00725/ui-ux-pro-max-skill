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
  /** Aligned with `photos` (same order, same length). */
  photoIds: string[]
  prompts: ProfilePrompt[]
  superLikedMe: boolean
}

export interface ProfilePrompt {
  id: string
  key: string
  answer: string
}

/** What a like points at: a specific photo or prompt (Hinge-style). */
export type LikeTarget =
  | { kind: 'photo'; id: string; url: string }
  | { kind: 'prompt'; id: string; key: string; answer: string }

export interface LikeExtras {
  comment?: string
  photoId?: string
  promptId?: string
}

export interface SuperQuota {
  remaining: number // 0 or 1
  resetsAt: string | null
}

export interface LikeReceived extends DiscoveryCard {
  likedAt: string
  isSuper: boolean
  comment: string | null
  likedPhotoUrl: string | null
  likedPrompt: { key: string; answer: string } | null
}

export interface ChatMessage {
  id: number | null // null until the server confirms the insert
  client_id: string
  match_id: string
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
  kind: 'text' | 'like_comment'
  /** For like_comment: what was liked (set by the match trigger). */
  context: { super?: boolean; photo_id?: string; prompt_key?: string; prompt_answer?: string } | null
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
  | { ok: true; matchId: string | null; quota: SwipeQuota; superQuota: SuperQuota }
  | {
      ok: false
      reason: 'limit' | 'super-limit' | 'error'
      message: string
      quota?: SwipeQuota
      superQuota?: SuperQuota
    }

export interface Selection {
  cards: DiscoveryCard[]
  quota: SwipeQuota
  superQuota: SuperQuota
}

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

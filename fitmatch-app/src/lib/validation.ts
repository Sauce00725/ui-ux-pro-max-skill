import { z } from 'zod'

// Shared by client (per-step validation) and server actions (source of truth).

export const GENDERS = ['woman', 'man', 'nonbinary'] as const
export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  woman: 'Woman',
  man: 'Man',
  nonbinary: 'Nonbinary',
}

export const TRAINING_TIMES = [
  'early_morning',
  'morning',
  'midday',
  'evening',
  'late_night',
  'weekends',
] as const
export const TRAINING_TIME_LABELS: Record<(typeof TRAINING_TIMES)[number], string> = {
  early_morning: 'Early morning',
  morning: 'Morning',
  midday: 'Lunch break',
  evening: 'Evening',
  late_night: 'Late night',
  weekends: 'Weekends',
}

export const FITNESS_LEVELS = ['Just starting', 'Casual', 'Regular', 'Dedicated', 'Competitive'] as const

/** Level 1–2 counts as "starting out" for beginner ↔ helper matching (mirrors 0003 SQL). */
export const BEGINNER_MAX_LEVEL = 2

export const GOALS = [
  'get_in_shape',
  'lose_weight',
  'build_strength',
  'build_endurance',
  'train_for_event',
  'stay_consistent',
  'feel_better',
] as const
export const GOAL_LABELS: Record<(typeof GOALS)[number], string> = {
  get_in_shape: 'Get in shape',
  lose_weight: 'Lose weight',
  build_strength: 'Build strength',
  build_endurance: 'Build endurance',
  train_for_event: 'Train for an event',
  stay_consistent: 'Stay consistent',
  feel_better: 'Feel better',
}
export const MAX_GOALS = 3

/** Hinge-style prompts (keys mirror the CHECK in migration 0004). */
export const PROMPTS = {
  sunday_workout: 'My ideal Sunday workout',
  gym_hot_take: 'My gym hot take',
  post_workout: 'Best post-workout meal',
  training_for: 'Right now I’m training for',
  gets_me_moving: 'What gets me moving',
  first_workout: 'Our first workout together would be',
  starting_out: 'I’m just getting started and',
  green_flag: 'A green flag at the gym',
} as const
export type PromptKey = keyof typeof PROMPTS
export const PROMPT_KEYS = Object.keys(PROMPTS) as [PromptKey, ...PromptKey[]]
export const MAX_PROMPTS = 3
export const PROMPT_ANSWER_MAX = 200
export const LIKE_COMMENT_MAX = 280

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
] as const

export function ageFromBirthdate(isoDate: string, today = new Date()): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--
  return age
}

const birthdate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')
  .refine((v) => ageFromBirthdate(v) >= 18, 'You must be 18 or older to join')
  .refine((v) => ageFromBirthdate(v) <= 100, 'Enter a valid date')

// ─── Auth ────────────────────────────────────────────────────────────────────

export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(72, 'Use 72 characters or fewer')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number'),
    confirmPassword: z.string(),
    birthdate,
    acceptTerms: z.literal('on', { errorMap: () => ({ message: 'You must accept the terms to continue' }) }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

// ─── Onboarding (one schema per step, merged for the final submit) ──────────

const locationMsg = 'Share your location so we can show people near you'

export const basicsSchema = z.object({
  displayName: z.string().trim().min(2, 'Use at least 2 characters').max(40, 'Keep it under 40 characters'),
  birthdate,
  gender: z.enum(GENDERS, { errorMap: () => ({ message: 'Choose one' }) }),
  bio: z.string().trim().max(500, 'Keep it under 500 characters'),
  city: z.string().trim().min(2, 'Enter your city').max(60),
  state: z.enum(US_STATES, { errorMap: () => ({ message: 'Choose your state' }) }),
  lat: z.number({ invalid_type_error: locationMsg, required_error: locationMsg }).min(-90).max(90),
  lng: z.number({ invalid_type_error: locationMsg, required_error: locationMsg }).min(-180).max(180),
})

export const fitnessSchema = z.object({
  activityIds: z.array(z.number().int().positive()).min(1, 'Pick at least one activity').max(8, 'Pick up to 8'),
  fitnessLevel: z.number({ invalid_type_error: 'Choose your level' }).int().min(1).max(5),
  trainingTimes: z.array(z.enum(TRAINING_TIMES)).max(TRAINING_TIMES.length),
  goals: z.array(z.enum(GOALS)).max(MAX_GOALS, `Pick up to ${MAX_GOALS}`),
  helpsBeginners: z.boolean(),
})

const modePrefsSchema = z
  .object({
    enabled: z.boolean(),
    headline: z.string().trim().max(80, 'Keep it under 80 characters'),
    minAge: z.number().int().min(18).max(99),
    maxAge: z.number().int().min(18).max(99),
    maxDistanceMi: z.number().int().min(1).max(100),
    interestedIn: z.array(z.enum(GENDERS)),
  })
  .refine((m) => m.minAge <= m.maxAge, { path: ['maxAge'], message: 'Max age must be at least min age' })

export const modesSchema = z.object({
  modes: z
    .object({ buddy: modePrefsSchema, dating: modePrefsSchema })
    .refine((m) => m.buddy.enabled || m.dating.enabled, { message: 'Turn on at least one mode' })
    .refine((m) => !m.dating.enabled || m.dating.interestedIn.length > 0, {
      path: ['dating', 'interestedIn'],
      message: 'Choose who you want to see',
    }),
})

export const photosSchema = z.object({
  photoPaths: z.array(z.string().min(1)).min(1, 'Add at least one photo').max(6, 'Up to 6 photos'),
})

export const promptsSchema = z.object({
  prompts: z
    .array(
      z.object({
        key: z.enum(PROMPT_KEYS),
        answer: z.string().trim().min(1, 'Write an answer or remove this prompt').max(PROMPT_ANSWER_MAX, `Keep it under ${PROMPT_ANSWER_MAX} characters`),
      }),
    )
    .max(MAX_PROMPTS, `Up to ${MAX_PROMPTS} prompts`)
    .refine((list) => new Set(list.map((p) => p.key)).size === list.length, 'Use each prompt once'),
})

export const onboardingSchema = basicsSchema
  .merge(fitnessSchema)
  .merge(modesSchema)
  .merge(promptsSchema)
  .merge(photosSchema)

export type OnboardingInput = z.infer<typeof onboardingSchema>
export type ModePrefs = z.infer<typeof modePrefsSchema>

// ─── Matching / chat ─────────────────────────────────────────────────────────

export const swipeSchema = z
  .object({
    targetId: z.string().uuid(),
    mode: z.enum(['dating', 'buddy']),
    action: z.enum(['like', 'pass']),
    super: z.boolean().default(false),
    comment: z.string().trim().max(LIKE_COMMENT_MAX).optional(),
    photoId: z.string().uuid().optional(),
    promptId: z.string().uuid().optional(),
  })
  .refine((s) => !(s.photoId && s.promptId), 'Like one photo or one prompt')
  .refine((s) => s.action === 'like' || (!s.super && !s.comment && !s.photoId && !s.promptId), 'Only likes carry extras')

export const REPORT_REASONS = {
  harassment: 'Harassment or threats',
  fake: 'Fake profile or scam',
  underage: 'Appears under 18',
  inappropriate: 'Inappropriate photos or messages',
  spam: 'Spam or selling something',
  other: 'Something else',
} as const

export const reportSchema = z.object({
  matchId: z.string().uuid(),
  reason: z.enum(Object.keys(REPORT_REASONS) as [keyof typeof REPORT_REASONS, ...(keyof typeof REPORT_REASONS)[]]),
  details: z.string().trim().max(1000),
})

/** Flattens zod issues into `{ "modes.dating.interestedIn": "message" }`. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    out[key] ??= issue.message
  }
  return out
}

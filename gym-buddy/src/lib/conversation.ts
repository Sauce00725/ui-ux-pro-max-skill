import type { AppMode } from './types'
import { PROMPTS, type PromptKey } from './validation'

/*
 * Getting a conversation going: openers drawn from what the other person
 * wrote and what you both do, and active date (or session) ideas. Pure
 * functions, so the chat, the prototype and any test use the same text.
 * Every suggestion fills the message box; nothing is ever sent for you.
 */

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`)

/** What to ask after quoting someone's prompt answer. */
const FOLLOW_UPS: Partial<Record<PromptKey, string>> = {
  my_gym: 'what’s the first thing you do when you walk in?',
  gym_time: 'is that the quietest hour there?',
  favorite_lift: 'what’s your best on it so far?',
  training_split: 'which day do you secretly dread?',
  gym_hot_take: 'okay, defend it.',
  gym_pet_peeve: 'what’s the worst one you’ve seen?',
  green_flag: 'what’s an instant red one?',
  gym_playlist: 'what song gets you through the last set?',
  pre_workout_ritual: 'does it ever fail you?',
  leg_day: 'what’s the most underrated leg exercise?',
  cardio_or_weights: 'I have notes. Convince me.',
  gym_fail: 'has it happened again since?',
  spot_me: 'deal. What would you want a spot on?',
  ideal_partner: 'what makes a session with someone great?',
  training_for: 'how’s training going so far?',
  fitness_goal: 'how close are you?',
  proudest_pr: 'how long did that take?',
  bucket_list_race: 'when are you thinking?',
  gets_me_moving: 'what got you started?',
  sunday_workout: 'coffee before or after?',
  first_workout: 'I’m in. When were you thinking?',
  rest_day: 'what’s the best part?',
  post_workout: 'where do you get it around here?',
  cheat_meal: 'best place in town for it?',
  supplement: 'has it actually made a difference?',
  starting_out: 'what made you want to start?',
  simple_pleasures: 'what’s next on the list?',
  perfect_day: 'which part do you get to do most often?',
  weekend_find_me: 'where would you take someone new to it?',
  ask_me_about: 'okay, I’m asking.',
  win_me_over: 'noted. What’s the second way?',
  looking_for: 'what does that look like on a normal week?',
  unpopular_opinion: 'I have questions.',
  two_truths: 'my guess for the lie is the second one.',
  dont_hate_me: 'no hate here. What else should I know?',
  currently_obsessed: 'how did you get into it?',
  dream_trip: 'what would you do first?',
  comfort_food: 'best place in town for it?',
  love_language: 'what’s the best example you’ve had of it?',
  together_we_could: 'I’m in. When?',
}

const ACTIVITY_OPENERS: Record<string, string> = {
  Running: 'Fellow runner! What’s your favorite route around here?',
  Walking: 'What’s the best walk in town, in your opinion?',
  Hiking: 'Best trail you’ve done lately?',
  Climbing: 'Bouldering or ropes? And what are you projecting?',
  Yoga: 'Favorite studio, or are you a home-practice person?',
  Pilates: 'Mat or reformer?',
  Pickleball: 'What’s your level? I could use a doubles partner.',
  Tennis: 'Singles or doubles?',
  Cycling: 'Road, gravel or a cruiser with a basket?',
  Swimming: 'Pool or open water?',
  Weightlifting: 'What are you working on in the gym right now?',
  CrossFit: 'Which WOD do you love to hate?',
  HYROX: 'Which HYROX station is your nemesis?',
  'Boxing / MMA': 'How long have you been training? I’d love some pad-work tips.',
  Basketball: 'Where’s the best pickup game in town?',
  'Dance fitness': 'Which class got you hooked?',
  Triathlon: 'Which leg of the tri is your favorite?',
  'Learning the gym': 'Starting out too? What’s been the hardest part so far?',
  'Home workouts': 'What’s your go-to home workout?',
}

/** Up to three openers: one about their prompt, one about what you both do, one easy one. */
export function openersFor({
  mode,
  prompts = [],
  sharedActivities = [],
}: {
  mode: AppMode
  prompts?: { key: string; answer: string }[]
  sharedActivities?: string[]
}): string[] {
  const out: string[] = []

  const prompt = prompts.find((p) => p.answer.trim())
  if (prompt) {
    const key = prompt.key as PromptKey
    const first = prompt.answer.trim().split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, '')
    const lead = first.length <= 40 ? `“${first}”` : `Your “${clip(PROMPTS[key] ?? 'prompt', 40)}” answer`
    out.push(`${lead}: ${FOLLOW_UPS[key] ?? 'tell me more?'}`)
  }

  const activity = sharedActivities[0]
  if (activity) out.push(ACTIVITY_OPENERS[activity] ?? `We both do ${activity.toLowerCase()}. How did you get into it?`)

  out.push(
    mode === 'dating'
      ? 'Coffee after a workout, or a workout after coffee?'
      : 'What does your training week look like? Want to train together this weekend?',
  )
  return out
}

export interface DateIdea {
  id: string
  title: string
  /** The message it fills in, ready to edit. */
  pitch: string
}

const IDEAS: Record<string, Omit<DateIdea, 'id'>> = {
  Running: { title: 'An easy run, then coffee', pitch: 'Want to do an easy run together this weekend and grab coffee after? Your pace.' },
  Walking: { title: 'A long walk somewhere green', pitch: 'Want to go for a long walk somewhere green this weekend?' },
  Hiking: { title: 'A short hike with a view', pitch: 'Up for a short hike with a view this weekend? I’ll bring snacks.' },
  Climbing: { title: 'Bouldering, then tacos', pitch: 'Want to go bouldering one evening and get tacos after?' },
  Yoga: { title: 'A morning class and brunch', pitch: 'Want to try a morning yoga class together and get brunch after?' },
  Pilates: { title: 'A class, then smoothies', pitch: 'Want to take a Pilates class together and get smoothies after?' },
  Pickleball: { title: 'Doubles at open play', pitch: 'Want to be my doubles partner at open play this week?' },
  Tennis: { title: 'A friendly hit', pitch: 'Want to hit some balls one evening this week?' },
  Cycling: { title: 'A slow ride to a café', pitch: 'Want to ride somewhere with good coffee this weekend? No-drop, I promise.' },
  Swimming: { title: 'Laps, then breakfast', pitch: 'Want to swim some laps one morning and get breakfast after?' },
  Weightlifting: { title: 'A partner workout', pitch: 'Want to train together one evening this week? I’ll spot you.' },
  CrossFit: { title: 'A partner WOD', pitch: 'Want to do a partner WOD together this week?' },
  HYROX: { title: 'Sled pushes, then pancakes', pitch: 'Want to do a HYROX-style session together and get pancakes after?' },
  'Boxing / MMA': { title: 'A pad-work session', pitch: 'Want to do some pad work together this week?' },
  Basketball: { title: 'Shooting around at the park', pitch: 'Want to shoot around at the park one evening?' },
  'Dance fitness': { title: 'A dance class', pitch: 'Want to try a dance class together? Zero skill required.' },
  Triathlon: { title: 'A short swim and ride', pitch: 'Want to do a short swim and ride one morning, then coffee?' },
  'Learning the gym': { title: 'A first gym session, slowly', pitch: 'Want to go to the gym together and take it slow? No pressure at all.' },
  'Home workouts': { title: 'A workout in the park', pitch: 'Want to do a bodyweight workout in the park one morning?' },
}

/**
 * Ideas from what you both do (up to three), plus a low-key one: not
 * everyone wants a workout to be the first date.
 */
export function dateIdeasFor({ mode, sharedActivities = [] }: { mode: AppMode; sharedActivities?: string[] }): DateIdea[] {
  const active = sharedActivities.filter((a) => IDEAS[a]).slice(0, 3)
  const ideas = (active.length ? active : ['Walking']).map((a) => ({ id: a, ...IDEAS[a] }))
  ideas.push(
    mode === 'dating'
      ? { id: 'coffee', title: 'Just a coffee first', pitch: 'Want to grab a coffee first and see where it goes?' }
      : { id: 'coffee', title: 'A coffee and a plan', pitch: 'Want to grab a coffee and plan a few sessions?' },
  )
  return ideas
}

/** First meetups, kept safe. Shown wherever a date gets planned. */
export const SAFETY_TIPS: Record<AppMode, string[]> = {
  dating: [
    'Meet somewhere public, and keep it there for the first few dates.',
    'Tell a friend where you’re going and when.',
    'Get yourself there and back.',
    'Keep chatting here until you’re ready to share your number.',
  ],
  buddy: ['Meet at the venue for your first session, and tell a friend where you’ll be.'],
}

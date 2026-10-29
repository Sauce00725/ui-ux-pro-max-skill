import type { Intent, PromptKey } from '@/lib/validation'
import type { Motif } from './art'

/*
 * The cast. Everyone here is invented; the details are the kind the real app
 * collects (activities, goals, a level, a few prompts). Ordered the way the
 * decks deal them: the first card in each mode is a person who likes you back,
 * so the first right-swipe shows the match scene.
 */

export interface Person {
  id: string
  name: string
  age: number
  city: string
  state: string
  headline: string
  bio?: string
  /** 1 Just starting … 5 Competitive */
  level: 1 | 2 | 3 | 4 | 5
  times: string[]
  verified?: boolean
  distance: number
  activities: string[]
  goals: string[]
  helps?: boolean
  prompts: { key: PromptKey; answer: string }[]
  art: { seed: number; motif: Motif; mood?: number }[]
  /** Likes you already: swiping right on them is a match. */
  likesMe?: boolean
  /** Shown as "Super liked you" on their card. */
  superLikedMe?: boolean
  spanish?: boolean
  /** Dating only: what they're looking for. */
  intent?: Intent
}

/** Someone who liked you before you saw them (the Likes tab). */
export interface Admirer extends Person {
  comment: string | null
  isSuper: boolean
  /** What they liked: one of YOUR photos or prompts. */
  liked: { kind: 'photo'; index: number } | { kind: 'prompt'; key: PromptKey } | null
  likedAgoMin: number
}

/** You. */
export const ME = {
  id: 'me',
  name: 'Alex',
  email: 'alex@demo.gymbuddy',
  activities: ['Running', 'Weightlifting', 'Hiking', 'Pickleball'],
  goals: ['build_strength', 'stay_consistent'],
  intent: 'long_term' as Intent,
  art: [
    { seed: 101, motif: 'run' as Motif, mood: 3 },
    { seed: 102, motif: 'lift' as Motif, mood: 0 },
    { seed: 103, motif: 'climb' as Motif, mood: 1 },
  ],
  prompts: [
    { key: 'leg_day' as PromptKey, answer: 'A personality test. I pass.' },
    { key: 'my_gym' as PromptKey, answer: 'Zilker Park trail at dawn, then Iron Works.' },
  ],
}

export const DATING: Person[] = [
  {
    id: 'd-jordan', intent: 'long_term', name: 'Jordan', age: 29, city: 'Austin', state: 'TX', distance: 3, level: 4, verified: true,
    headline: 'Need a Saturday long-run partner',
    times: ['early_morning', 'weekends'], activities: ['Running', 'HYROX', 'Weightlifting'], goals: ['build_endurance', 'train_for_event'],
    prompts: [
      { key: 'my_gym', answer: 'Iron Works, East Austin. Come for the chalk, stay for the playlist.' },
      { key: 'training_for', answer: 'My first HYROX in March. Pray for my sled push.' },
    ],
    art: [{ seed: 1, motif: 'run', mood: 0 }, { seed: 2, motif: 'lift', mood: 4 }],
    likesMe: true,
  },
  {
    id: 'd-maya', intent: 'long_open', name: 'Maya', age: 27, city: 'Austin', state: 'TX', distance: 4, level: 3,
    headline: 'Pickleball addict, brunch enabler',
    times: ['morning', 'weekends'], activities: ['Pickleball', 'Yoga'], goals: ['stay_consistent', 'feel_better'],
    prompts: [
      { key: 'weekend_find_me', answer: 'At the courts by 8, brunch by 11, nap by 1.' },
      { key: 'ask_me_about', answer: 'How I went from “what’s a dink?” to a 4.0 in a year.' },
    ],
    art: [{ seed: 3, motif: 'court', mood: 3 }, { seed: 4, motif: 'yoga', mood: 5 }],
  },
  {
    id: 'd-priya', intent: 'life_partner', name: 'Priya', age: 31, city: 'Round Rock', state: 'TX', distance: 11, level: 3, verified: true,
    headline: 'Trail runner. Slow on purpose.',
    times: ['early_morning'], activities: ['Running', 'Hiking'], goals: ['build_endurance', 'feel_better'],
    prompts: [
      { key: 'perfect_day', answer: 'Eight miles of dirt, a taco truck, and no phone signal.' },
      { key: 'favorite_lift', answer: 'The deadlift. Strong legs make long trails kinder.' },
    ],
    art: [{ seed: 5, motif: 'run', mood: 3 }],
  },
  {
    id: 'd-dev', intent: 'figuring_out', name: 'Dev', age: 30, city: 'Austin', state: 'TX', distance: 6, level: 4,
    headline: 'Lifting, then lingering at the smoothie bar',
    times: ['evening'], activities: ['Weightlifting', 'CrossFit'], goals: ['build_strength'],
    prompts: [
      { key: 'training_split', answer: 'Push, pull, legs, and one day of pretending I stretch.' },
      { key: 'green_flag', answer: 'Someone who re-racks their weights without being asked.' },
    ],
    art: [{ seed: 6, motif: 'lift', mood: 5 }, { seed: 7, motif: 'lift', mood: 2 }],
  },
  {
    id: 'd-theo', intent: 'long_term', name: 'Theo', age: 33, city: 'Cedar Park', state: 'TX', distance: 14, level: 3,
    headline: 'Cyclist, cat dad, terrible at parallel parking',
    times: ['early_morning', 'weekends'], activities: ['Cycling', 'Running'], goals: ['build_endurance', 'stay_consistent'],
    prompts: [
      { key: 'currently_obsessed', answer: 'Gravel routes I definitely shouldn’t take a road bike on.' },
      { key: 'together_we_could', answer: 'Ride to the lake, argue about the best breakfast taco.' },
    ],
    art: [{ seed: 8, motif: 'bike', mood: 4 }],
  },
  {
    id: 'd-noor', intent: 'short_open', name: 'Noor', age: 26, city: 'Austin', state: 'TX', distance: 2, level: 3, verified: true,
    headline: 'Climbing gym regular. Chalk on everything.',
    times: ['evening', 'weekends'], activities: ['Climbing', 'Yoga', 'Hiking'], goals: ['build_strength', 'feel_better'],
    prompts: [
      { key: 'spot_me', answer: 'You tell me the truth about my beta and don’t gloat.' },
      { key: 'dream_trip', answer: 'Fontainebleau, with a crash pad and snacks.' },
    ],
    art: [{ seed: 9, motif: 'climb', mood: 2 }, { seed: 10, motif: 'yoga', mood: 1 }],
  },
  {
    id: 'd-ellis', name: 'Ellis', age: 28, city: 'Austin', state: 'TX', distance: 5, level: 2,
    headline: 'Learning to love cardio',
    times: ['morning'], activities: ['Walking', 'Cycling'], goals: ['get_in_shape', 'feel_better'],
    prompts: [
      { key: 'cardio_or_weights', answer: 'Weights. But I’m trying cardio with a good podcast. Recommendations welcome.' },
      { key: 'starting_out', answer: 'I’m just getting started and I’d love someone patient.' },
    ],
    art: [{ seed: 11, motif: 'bike', mood: 1 }],
  },
  {
    id: 'd-kai', intent: 'long_term', name: 'Kai', age: 29, city: 'Pflugerville', state: 'TX', distance: 13, level: 4,
    headline: 'Swim at six, coffee at seven',
    times: ['early_morning'], activities: ['Swimming', 'Running', 'Triathlon'], goals: ['train_for_event', 'build_endurance'],
    prompts: [
      { key: 'pre_workout_ritual', answer: 'Cold plunge, two espressos, one dramatic playlist.' },
      { key: 'bucket_list_race', answer: 'A half-Ironman somewhere with a view.' },
    ],
    art: [{ seed: 12, motif: 'swim', mood: 1 }],
  },
  {
    id: 'd-remy', intent: 'short_term', name: 'Remy', age: 32, city: 'Austin', state: 'TX', distance: 7, level: 4, verified: true,
    headline: 'Dance cardio instructor. Yes, I’ll make you do it.',
    times: ['evening'], activities: ['Dance fitness', 'Yoga'], goals: ['stay_consistent', 'feel_better'],
    prompts: [
      { key: 'gym_playlist', answer: 'Salsa, 2000s pop, and exactly one sea shanty.' },
      { key: 'love_language', answer: 'Dancing badly in the kitchen.' },
    ],
    art: [{ seed: 13, motif: 'yoga', mood: 2 }, { seed: 14, motif: 'yoga', mood: 5 }],
  },
  {
    id: 'd-sasha', intent: 'figuring_out', name: 'Sasha', age: 25, city: 'Austin', state: 'TX', distance: 3, level: 1,
    headline: 'New to the gym. No judgment, please.',
    times: ['midday'], activities: ['Learning the gym', 'Walking'], goals: ['get_in_shape', 'stay_consistent'],
    prompts: [
      { key: 'starting_out', answer: 'I’m just getting started and I celebrate every set.' },
      { key: 'first_workout', answer: 'A walk, then machines with a patient friend.' },
    ],
    art: [{ seed: 15, motif: 'lift', mood: 3 }],
  },
  {
    id: 'd-wren', intent: 'life_partner', name: 'Wren', age: 34, city: 'Lakeway', state: 'TX', distance: 17, level: 3,
    headline: 'Rower and reader',
    times: ['early_morning', 'weekends'], activities: ['Hiking', 'Swimming'], goals: ['feel_better', 'stay_consistent'],
    prompts: [
      { key: 'simple_pleasures', answer: 'Still water at sunrise and a paperback with a cracked spine.' },
      { key: 'looking_for', answer: 'Is up for a long walk with no destination.' },
    ],
    art: [{ seed: 16, motif: 'swim', mood: 5 }],
  },
  {
    id: 'd-cam', name: 'Cam', age: 30, city: 'Austin', state: 'TX', distance: 8, level: 3,
    headline: 'Spikeball, pickleball, any ball',
    times: ['evening', 'weekends'], activities: ['Pickleball', 'Basketball', 'Tennis'], goals: ['stay_consistent', 'get_in_shape'],
    prompts: [
      { key: 'gym_hot_take', answer: 'Warm-ups are the best part of the workout.' },
      { key: 'win_me_over', answer: 'Beat me at anything and I’m yours. Also, snacks.' },
    ],
    art: [{ seed: 17, motif: 'court', mood: 0 }],
  },
]

export const BUDDIES: Person[] = [
  {
    id: 'b-alexandria', name: 'Alexandria', age: 31, city: 'Austin', state: 'TX', distance: 6, level: 4, helps: true, verified: true,
    headline: 'Early runs, late tacos',
    times: ['early_morning'], activities: ['Running', 'Hiking'], goals: ['build_strength', 'build_endurance'],
    prompts: [{ key: 'ideal_partner', answer: 'Someone who shows up. Pace is a detail.' }],
    art: [{ seed: 21, motif: 'run', mood: 4 }, { seed: 22, motif: 'run', mood: 3 }],
    likesMe: true, superLikedMe: true,
  },
  {
    id: 'b-sam', name: 'Sam', age: 26, city: 'Round Rock', state: 'TX', distance: 11, level: 1,
    headline: 'New to lifting. Looking for a patient partner.',
    times: ['evening'], activities: ['Learning the gym', 'Weightlifting'], goals: ['get_in_shape', 'stay_consistent'],
    prompts: [{ key: 'starting_out', answer: 'I’m just getting started and I don’t know what half the machines do yet.' }],
    art: [{ seed: 23, motif: 'lift', mood: 1 }],
  },
  {
    id: 'b-marcus', name: 'Marcus', age: 35, city: 'Austin', state: 'TX', distance: 4, level: 5, helps: true,
    headline: 'Spotter on call',
    times: ['evening', 'weekends'], activities: ['Weightlifting', 'CrossFit'], goals: ['build_strength'],
    prompts: [
      { key: 'spot_me', answer: 'You tell me your target and I’ll tell you the cue that fixed mine.' },
      { key: 'proudest_pr', answer: 'A 405 deadlift at 34, and the form to prove it.' },
    ],
    art: [{ seed: 24, motif: 'lift', mood: 5 }],
  },
  {
    id: 'b-lena', name: 'Lena', age: 28, city: 'Austin', state: 'TX', distance: 5, level: 4, helps: true, verified: true,
    headline: 'Run club regular, 5K to marathon',
    times: ['early_morning', 'weekends'], activities: ['Running', 'Yoga'], goals: ['train_for_event', 'build_endurance'],
    prompts: [{ key: 'training_for', answer: 'Austin Marathon. Join me for any of the long runs.' }],
    art: [{ seed: 25, motif: 'run', mood: 0 }, { seed: 26, motif: 'run', mood: 2 }],
  },
  {
    id: 'b-rob', name: 'Rob', age: 40, city: 'Cedar Park', state: 'TX', distance: 15, level: 2,
    headline: 'Back after a long break',
    times: ['morning'], activities: ['Walking', 'Cycling'], goals: ['feel_better', 'stay_consistent'],
    prompts: [{ key: 'starting_out', answer: 'I’m just getting started again and a walking partner would help a lot.' }],
    art: [{ seed: 27, motif: 'bike', mood: 3 }],
  },
  {
    id: 'b-nia', name: 'Nia', age: 27, city: 'Austin', state: 'TX', distance: 3, level: 4,
    headline: 'HIIT and good music',
    times: ['midday', 'evening'], activities: ['CrossFit', 'Boxing / MMA'], goals: ['build_strength', 'get_in_shape'],
    prompts: [{ key: 'gym_playlist', answer: 'Afrobeats until the last interval, then silence.' }],
    art: [{ seed: 28, motif: 'lift', mood: 2 }],
  },
  {
    id: 'b-hugo', name: 'Hugo', age: 32, city: 'Austin', state: 'TX', distance: 6, level: 4,
    headline: 'Calisthenics park crew',
    times: ['evening', 'weekends'], activities: ['Weightlifting', 'Climbing'], goals: ['build_strength'],
    prompts: [{ key: 'first_workout', answer: 'Pull-ups at the park, then the long way home.' }],
    art: [{ seed: 29, motif: 'climb', mood: 4 }],
  },
  {
    id: 'b-tess', name: 'Tess', age: 29, city: 'Austin', state: 'TX', distance: 2, level: 3, verified: true,
    headline: 'Yoga and mobility, no ego',
    times: ['morning', 'weekends'], activities: ['Yoga', 'Pilates', 'Hiking'], goals: ['feel_better', 'stay_consistent'],
    prompts: [{ key: 'rest_day', answer: 'Mobility flow, a long bath and an unreasonable amount of tea.' }],
    art: [{ seed: 30, motif: 'yoga', mood: 5 }],
  },
  {
    id: 'b-omar', name: 'Omar', age: 37, city: 'Round Rock', state: 'TX', distance: 12, level: 3,
    headline: 'Lane 3, early. Swimming partners welcome.',
    times: ['early_morning'], activities: ['Swimming', 'Triathlon'], goals: ['train_for_event'],
    prompts: [{ key: 'bucket_list_race', answer: 'The Alcatraz swim. Terrified and in.' }],
    art: [{ seed: 31, motif: 'swim', mood: 1 }],
  },
  {
    id: 'b-bea', name: 'Bea', age: 24, city: 'Austin', state: 'TX', distance: 4, level: 1,
    headline: 'Training for my very first 5K',
    times: ['morning'], activities: ['Running', 'Walking'], goals: ['train_for_event', 'stay_consistent'],
    prompts: [{ key: 'starting_out', answer: 'I’m just getting started and I run-walk without shame.' }],
    art: [{ seed: 32, motif: 'run', mood: 3 }],
  },
  {
    id: 'b-ivy', name: 'Ivy', age: 45, city: 'Austin', state: 'TX', distance: 7, level: 3, helps: true,
    headline: 'Pickleball and weights, three days a week',
    times: ['morning'], activities: ['Pickleball', 'Weightlifting'], goals: ['stay_consistent', 'build_strength'],
    prompts: [{ key: 'ideal_partner', answer: 'Anyone who laughs at their own missed shots.' }],
    art: [{ seed: 33, motif: 'court', mood: 4 }],
  },
  {
    id: 'b-luis', name: 'Luis', age: 30, city: 'Austin', state: 'TX', distance: 9, level: 3, spanish: true,
    headline: 'Fútbol y gimnasio. Hablo español e inglés.',
    times: ['evening'], activities: ['Weightlifting', 'Running'], goals: ['get_in_shape', 'stay_consistent'],
    prompts: [{ key: 'gym_hot_take', answer: 'El calentamiento no es opcional. Ni los sábados.' }],
    art: [{ seed: 34, motif: 'lift', mood: 0 }],
  },
]

/** People who liked you first (the Likes tab). */
export const ADMIRERS: Record<'dating' | 'buddy', Admirer[]> = {
  dating: [
    {
      id: 'ld-camila', intent: 'long_term', name: 'Camila', age: 28, city: 'Austin', state: 'TX', distance: 3, level: 4, verified: true, spanish: true,
      headline: 'Corredora y fan del tamal de los domingos',
      times: ['early_morning'], activities: ['Running', 'Yoga'], goals: ['train_for_event', 'feel_better'],
      prompts: [{ key: 'weekend_find_me', answer: 'En el sendero antes de las siete, con café en el termo.' }],
      art: [{ seed: 41, motif: 'run', mood: 4 }, { seed: 42, motif: 'yoga', mood: 2 }],
      comment: 'Me encantó tu foto del maratón. ¿Corremos juntos algún día?', isSuper: true,
      liked: { kind: 'photo', index: 0 }, likedAgoMin: 40,
    },
    {
      id: 'ld-ari', intent: 'long_open', name: 'Ari', age: 30, city: 'Austin', state: 'TX', distance: 5, level: 3,
      headline: 'Lifts heavy, laughs louder',
      times: ['evening'], activities: ['Weightlifting', 'Hiking'], goals: ['build_strength', 'stay_consistent'],
      prompts: [{ key: 'gym_pet_peeve', answer: 'Curling in the squat rack. Come on.' }],
      art: [{ seed: 43, motif: 'lift', mood: 5 }],
      comment: 'Leg day as a personality test is the best thing I’ve read all week.', isSuper: false,
      liked: { kind: 'prompt', key: 'leg_day' }, likedAgoMin: 300,
    },
    {
      id: 'ld-mika', name: 'Mika', age: 27, city: 'Austin', state: 'TX', distance: 6, level: 3,
      headline: 'Climbing, coffee, repeat',
      times: ['weekends'], activities: ['Climbing', 'Hiking'], goals: ['build_strength'],
      prompts: [{ key: 'perfect_day', answer: 'A long route, a short nap, a very large burrito.' }],
      art: [{ seed: 44, motif: 'climb', mood: 1 }],
      comment: null, isSuper: false, liked: { kind: 'photo', index: 2 }, likedAgoMin: 1500,
    },
  ],
  buddy: [
    {
      id: 'lb-jules', name: 'Jules', age: 33, city: 'Austin', state: 'TX', distance: 4, level: 4, helps: true,
      headline: 'Training for HYROX, need company',
      times: ['early_morning', 'weekends'], activities: ['HYROX', 'Running', 'Weightlifting'], goals: ['train_for_event', 'build_strength'],
      prompts: [{ key: 'training_for', answer: 'HYROX Austin in March. Sleds are my nemesis.' }],
      art: [{ seed: 45, motif: 'lift', mood: 0 }, { seed: 46, motif: 'run', mood: 1 }],
      comment: 'Saw your pace on the Zilker loop. Want to train for HYROX together?', isSuper: false,
      liked: { kind: 'photo', index: 1 }, likedAgoMin: 55,
    },
    {
      id: 'lb-kenji', name: 'Kenji', age: 36, city: 'Austin', state: 'TX', distance: 9, level: 3,
      headline: 'Saturday long hikes, snacks mandatory',
      times: ['weekends'], activities: ['Hiking', 'Running'], goals: ['feel_better', 'build_endurance'],
      prompts: [{ key: 'weekend_find_me', answer: 'On a ridge with a bag of trail mix.' }],
      art: [{ seed: 47, motif: 'run', mood: 3 }],
      comment: 'Same gym time, same trail. We should say hi.', isSuper: false,
      liked: { kind: 'prompt', key: 'my_gym' }, likedAgoMin: 420,
    },
    {
      id: 'lb-dani', name: 'Dani', age: 25, city: 'Austin', state: 'TX', distance: 3, level: 1,
      headline: 'Starting out and a little nervous',
      times: ['evening'], activities: ['Learning the gym', 'Walking'], goals: ['get_in_shape', 'stay_consistent'],
      prompts: [{ key: 'starting_out', answer: 'I’m just getting started and I’d love a friendly face.' }],
      art: [{ seed: 48, motif: 'lift', mood: 5 }],
      comment: 'You said you like helping beginners. Could we start with a walk?', isSuper: true,
      liked: null, likedAgoMin: 1900,
    },
  ],
}

/** Already matched when the prototype opens, with a conversation each. */
export const MATCHED: { mode: 'dating' | 'buddy'; person: Person; startedAgoMin: number }[] = [
  {
    mode: 'dating', startedAgoMin: 2900,
    person: {
      id: 'm-andre', name: 'Andre', age: 31, city: 'Austin', state: 'TX', distance: 4, level: 4,
      headline: 'Sunrise swims', times: ['early_morning'], activities: ['Swimming'], goals: ['build_endurance'],
      prompts: [], art: [{ seed: 61, motif: 'swim', mood: 1 }],
    },
  },
  {
    mode: 'buddy', startedAgoMin: 4300,
    person: {
      id: 'm-marisol', name: 'Marisol', age: 29, city: 'Austin', state: 'TX', distance: 5, level: 3, spanish: true,
      headline: 'Entreno por las mañanas', times: ['early_morning'], activities: ['Running', 'Weightlifting'], goals: ['stay_consistent'],
      prompts: [], art: [{ seed: 62, motif: 'run', mood: 4 }],
    },
  },
]

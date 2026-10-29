import { SettingsForm } from '@/components/settings/SettingsForm'
import { defaultMode } from '@/components/profile/ProfileFields'
import { signPhotoUrls } from '@/lib/discovery'
import { createClient } from '@/lib/supabase/server'
import type { ModePrefs, PromptKey } from '@/lib/validation'

export const metadata = { title: 'Profile & settings' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const id = user!.id

  const [{ data: profile }, { data: modes }, { data: acts }, { data: prompts }, { data: photos }, { data: activities }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('display_name, birthdate, gender, bio, city, state, fitness_level, training_times, goals, helps_beginners, status')
        .eq('id', id)
        .single(),
      supabase.from('profile_modes').select('*').eq('user_id', id),
      supabase.from('profile_activities').select('activity_id').eq('user_id', id),
      supabase.from('profile_prompts').select('prompt_key, answer').eq('user_id', id).order('position'),
      supabase.from('photos').select('storage_path, moderation').eq('user_id', id).order('position'),
      supabase.from('activities').select('id, name').order('name'),
    ])

  const urls = await signPhotoUrls(supabase, (photos ?? []).map((p) => p.storage_path))
  const toPrefs = (mode: 'buddy' | 'dating'): ModePrefs => {
    const m = modes?.find((r) => r.mode === mode)
    return m
      ? {
          enabled: m.is_active,
          headline: m.headline ?? '',
          minAge: m.min_age,
          maxAge: m.max_age,
          maxDistanceMi: m.max_distance_mi,
          interestedIn: m.interested_in,
          intent: m.intent ?? null,
        }
      : defaultMode(false)
  }

  return (
    <SettingsForm
      userId={id}
      email={user!.email ?? ''}
      activities={activities ?? []}
      paused={profile?.status === 'paused'}
      pendingPhotos={(photos ?? []).filter((p) => p.moderation === 'pending').length}
      initial={{
        basics: {
          displayName: profile?.display_name ?? '',
          birthdate: profile?.birthdate ?? '',
          gender: profile?.gender ?? '',
          bio: profile?.bio ?? '',
          city: profile?.city ?? '',
          state: profile?.state ?? '',
          lat: null,
          lng: null,
        },
        fitness: {
          activityIds: (acts ?? []).map((a) => a.activity_id),
          fitnessLevel: profile?.fitness_level ?? null,
          trainingTimes: profile?.training_times ?? [],
          goals: profile?.goals ?? [],
          helpsBeginners: profile?.helps_beginners ?? false,
        },
        modes: { buddy: toPrefs('buddy'), dating: toPrefs('dating') },
        prompts: (prompts ?? []).map((p) => ({ key: p.prompt_key as PromptKey, answer: p.answer })),
        photos: (photos ?? []).flatMap((p) => {
          const url = urls.get(p.storage_path)
          return url ? [{ path: p.storage_path, previewUrl: url }] : []
        }),
      }}
    />
  )
}

-- Welcome people who want to get in shape, not only people already training.
--
-- 1. Goals on profiles (what someone is working toward).
-- 2. A "happy to train with beginners" flag, so people starting out can find
--    patient partners, and experienced members can opt in to helping.
-- 3. Starter-friendly activities.
-- 4. Discovery ranks shared goals, and pairs beginners with helpers.

alter table profiles
  add column goals text[] not null default '{}'
    check (goals <@ array['get_in_shape', 'lose_weight', 'build_strength', 'build_endurance',
                          'train_for_event', 'stay_consistent', 'feel_better']::text[]
           and cardinality(goals) <= 3),
  add column helps_beginners boolean not null default false;

-- New columns need explicit column-level UPDATE grants (see 0001).
grant update (goals, helps_beginners) on profiles to authenticated;

insert into activities (slug, name) values
  ('walking', 'Walking'),
  ('home_workouts', 'Home workouts'),
  ('dance_fitness', 'Dance fitness'),
  ('beginner_gym', 'Learning the gym')
on conflict (slug) do nothing;

-- Return type changes, so drop and recreate.
drop function get_discovery(app_mode, int);

create function get_discovery(p_mode app_mode, p_limit int default 20)
returns table (
  user_id            uuid,
  display_name       text,
  age                int,
  gender             text,
  city               text,
  state              text,
  bio                text,
  headline           text,
  fitness_level      smallint,
  training_times     text[],
  is_verified        boolean,
  distance_mi        int,
  shared_activities  text[],
  other_activities   text[],
  photo_paths        text[],
  goals              text[],
  shared_goals       text[],
  helps_beginners    boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  with me as (
    select p.id, p.gender, p.training_times, p.goals, p.fitness_level, p.helps_beginners,
           date_part('year', age(p.birthdate))::int as age,
           l.location, pm.min_age, pm.max_age, pm.max_distance_mi, pm.interested_in
    from profiles p
    join user_locations l on l.user_id = p.id
    join profile_modes pm on pm.user_id = p.id and pm.mode = p_mode and pm.is_active
    where p.id = auth.uid() and p.status = 'active'
  ),
  candidates as (
    select p.*, pm.headline,
           date_part('year', age(p.birthdate))::int as c_age,
           st_distance(l.location, me.location) as meters,
           cardinality(array(select unnest(p.training_times)
                             intersect select unnest(me.training_times))) as time_overlap,
           array(select unnest(p.goals) intersect select unnest(me.goals)) as c_shared_goals,
           -- Beginner (level 1–2) meets someone who offered to help, either direction.
           ((coalesce(me.fitness_level, 3) <= 2 and p.helps_beginners)
             or (me.helps_beginners and coalesce(p.fitness_level, 3) <= 2)) as mentor_fit,
           exists (select 1 from swipes s
                   where s.swiper_id = p.id and s.swiped_id = me.id
                     and s.mode = p_mode and s.action = 'like') as liked_me
    from me
    join user_locations l
      on st_dwithin(l.location, me.location, me.max_distance_mi * 1609.34)
    join profiles p on p.id = l.user_id
    join profile_modes pm on pm.user_id = p.id and pm.mode = p_mode and pm.is_active
    where p.id <> me.id
      and p.status = 'active'
      and st_dwithin(l.location, me.location, pm.max_distance_mi * 1609.34)
      and date_part('year', age(p.birthdate)) between me.min_age and me.max_age
      and me.age between pm.min_age and pm.max_age
      and (cardinality(me.interested_in) = 0 or p.gender = any(me.interested_in))
      and (cardinality(pm.interested_in) = 0 or me.gender = any(pm.interested_in))
      and not exists (select 1 from swipes s
                      where s.swiper_id = me.id and s.swiped_id = p.id and s.mode = p_mode)
      and not exists (select 1 from swipes s
                      where s.swiper_id = p.id and s.swiped_id = me.id
                        and s.mode = p_mode and s.action = 'pass')
      and not exists (select 1 from blocks b
                      where (b.blocker_id = me.id and b.blocked_id = p.id)
                         or (b.blocker_id = p.id and b.blocked_id = me.id))
      and exists (select 1 from photos ph where ph.user_id = p.id and ph.moderation = 'approved')
  )
  select c.id, c.display_name, c.c_age, c.gender, c.city, c.state, c.bio, c.headline,
         c.fitness_level, c.training_times, c.is_verified,
         greatest(1, round(c.meters / 1609.34))::int,
         coalesce(acts.shared, '{}'), coalesce(acts.other, '{}'),
         coalesce(ph.paths, '{}'),
         c.goals, c.c_shared_goals, c.helps_beginners
  from candidates c
  left join lateral (
    select array_agg(a.name order by a.name) filter (where mine.activity_id is not null) as shared,
           array_agg(a.name order by a.name) filter (where mine.activity_id is null)     as other
    from profile_activities pa
    join activities a on a.id = pa.activity_id
    left join profile_activities mine
      on mine.user_id = auth.uid() and mine.activity_id = pa.activity_id
    where pa.user_id = c.id
  ) acts on true
  left join lateral (
    select array_agg(storage_path order by position) as paths
    from photos where user_id = c.id and moderation = 'approved'
  ) ph on true
  order by
      coalesce(cardinality(acts.shared), 0) * 10   -- shared activities matter most
    + cardinality(c.c_shared_goals) * 6            -- working toward the same thing
    + case when c.mentor_fit then 8 else 0 end     -- beginner ↔ willing helper
    + c.time_overlap * 4                           -- same training schedule
    + case when c.liked_me then 6 else 0 end
    + case when c.last_active_at > now() - interval '3 days' then 5 else 0 end
    - c.meters / 1609.34 / 5
    desc,
    c.id
  limit least(p_limit, 50);
$$;

revoke execute on function get_discovery(app_mode, int) from public, anon;
grant  execute on function get_discovery(app_mode, int) to authenticated;

-- FitMatch — initial schema
-- Profiles, two match modes (dating / buddy), swipes, matches, real-time
-- messages, safety tables, and the discovery feed. Every table has RLS on.

create extension if not exists postgis with schema extensions;

create type app_mode     as enum ('dating', 'buddy');
create type swipe_action as enum ('like', 'pass');
create type mod_status   as enum ('pending', 'approved', 'rejected');

-- ─── PROFILES ────────────────────────────────────────────────────────────────

create table profiles (
  id              uuid primary key references auth.users on delete cascade,
  display_name    text not null check (char_length(display_name) between 2 and 40),
  birthdate       date not null,
  gender          text not null check (gender in ('woman', 'man', 'nonbinary')),
  bio             text check (char_length(bio) <= 500),
  city            text,
  state           char(2),
  fitness_level   smallint check (fitness_level between 1 and 5),
  training_times  text[] not null default '{}',
  is_verified     boolean not null default false,
  status          text not null default 'active'
                  check (status in ('active', 'paused', 'banned')),
  last_active_at  timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- 18+ is checked in the app too; this is the backstop. (A trigger rather than
-- a CHECK because current_date isn't immutable.)
create function enforce_adult() returns trigger language plpgsql as $$
begin
  if new.birthdate > (current_date - interval '18 years')::date then
    raise exception 'Users must be 18 or older';
  end if;
  return new;
end $$;

create trigger profiles_adult before insert or update of birthdate on profiles
for each row execute function enforce_adult();

-- Location lives in its own owner-only table so no client query can ever read
-- another user's coordinates. Discovery reads it via a security-definer function.
create table user_locations (
  user_id     uuid primary key references profiles on delete cascade,
  location    extensions.geography(point, 4326) not null,
  updated_at  timestamptz not null default now()
);
create index user_locations_geo_idx on user_locations using gist (location);

create table profile_modes (
  user_id          uuid references profiles on delete cascade,
  mode             app_mode,
  is_active        boolean not null default true,
  headline         text check (char_length(headline) <= 80),
  min_age          smallint not null default 18 check (min_age >= 18),
  max_age          smallint not null default 99 check (max_age <= 99),
  max_distance_mi  smallint not null default 25 check (max_distance_mi between 1 and 100),
  -- Genders this person wants to see. Empty = everyone (also used in buddy
  -- mode, e.g. "women-only gym buddies").
  interested_in    text[] not null default '{}',
  primary key (user_id, mode),
  check (min_age <= max_age)
);

create table photos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles on delete cascade,
  storage_path  text not null unique,
  position      smallint not null default 0,
  moderation    mod_status not null default 'pending',
  created_at    timestamptz not null default now()
);
create index photos_user_idx on photos (user_id, position);

create table activities (
  id    smallserial primary key,
  slug  text unique not null,
  name  text not null
);

insert into activities (slug, name) values
  ('lifting', 'Weightlifting'), ('running', 'Running'), ('crossfit', 'CrossFit'),
  ('pickleball', 'Pickleball'), ('cycling', 'Cycling'), ('yoga', 'Yoga'),
  ('hiking', 'Hiking'), ('climbing', 'Climbing'), ('swimming', 'Swimming'),
  ('boxing', 'Boxing / MMA'), ('tennis', 'Tennis'), ('hyrox', 'HYROX'),
  ('pilates', 'Pilates'), ('basketball', 'Basketball'), ('triathlon', 'Triathlon');

create table profile_activities (
  user_id      uuid references profiles on delete cascade,
  activity_id  smallint references activities,
  primary key (user_id, activity_id)
);

-- ─── SWIPES & MATCHES ────────────────────────────────────────────────────────

create table swipes (
  swiper_id   uuid references profiles on delete cascade,
  swiped_id   uuid references profiles on delete cascade,
  mode        app_mode not null,
  action      swipe_action not null,
  created_at  timestamptz not null default now(),
  primary key (swiper_id, swiped_id, mode),
  check (swiper_id <> swiped_id)
);
create index swipes_incoming_idx on swipes (swiped_id, mode, action);

create table matches (
  id               uuid primary key default gen_random_uuid(),
  user_a           uuid not null references profiles on delete cascade,
  user_b           uuid not null references profiles on delete cascade,
  mode             app_mode not null,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz,
  unmatched_at     timestamptz,
  unmatched_by     uuid references profiles,
  check (user_a < user_b),
  unique (user_a, user_b, mode)
);
create index matches_user_b_idx on matches (user_b);

create function handle_like() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.action <> 'like' then return new; end if;

  -- Serialize per pair so two simultaneous likes can't both miss each other.
  perform pg_advisory_xact_lock(hashtext(
    least(new.swiper_id, new.swiped_id)::text ||
    greatest(new.swiper_id, new.swiped_id)::text || new.mode::text));

  if exists (select 1 from swipes
             where swiper_id = new.swiped_id and swiped_id = new.swiper_id
               and mode = new.mode and action = 'like') then
    insert into matches (user_a, user_b, mode)
    values (least(new.swiper_id, new.swiped_id),
            greatest(new.swiper_id, new.swiped_id), new.mode)
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger on_swipe after insert on swipes
for each row execute function handle_like();

-- ─── MESSAGES ────────────────────────────────────────────────────────────────

create table messages (
  id          bigint generated always as identity primary key,
  client_id   uuid not null unique,   -- generated by the sender; dedupes optimistic UI
  match_id    uuid not null references matches on delete cascade,
  sender_id   uuid not null references profiles on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index messages_thread_idx on messages (match_id, created_at desc);

create function touch_match() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update matches set last_message_at = new.created_at where id = new.match_id;
  return new;
end $$;

create trigger on_message after insert on messages
for each row execute function touch_match();

-- ─── SAFETY ──────────────────────────────────────────────────────────────────

create table blocks (
  blocker_id  uuid references profiles on delete cascade,
  blocked_id  uuid references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references profiles on delete cascade,
  reported_id  uuid not null references profiles on delete cascade,
  message_id   bigint references messages on delete set null,
  reason       text not null check (reason in ('harassment', 'fake', 'underage', 'spam', 'inappropriate', 'other')),
  details      text check (char_length(details) <= 1000),
  status       text not null default 'open'
               check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at   timestamptz not null default now()
);

create function is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks
                 where (blocker_id = a and blocked_id = b)
                    or (blocker_id = b and blocked_id = a));
$$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────

alter table profiles           enable row level security;
alter table user_locations     enable row level security;
alter table profile_modes      enable row level security;
alter table photos             enable row level security;
alter table activities         enable row level security;
alter table profile_activities enable row level security;
alter table swipes             enable row level security;
alter table matches            enable row level security;
alter table messages           enable row level security;
alter table blocks             enable row level security;
alter table reports            enable row level security;

-- Profiles: you can read yourself, and anyone you've matched with.
-- (Strangers are only ever seen through get_discovery.)
create policy "read own or matched profile" on profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from matches m
    where m.unmatched_at is null
      and ((m.user_a = auth.uid() and m.user_b = profiles.id)
        or (m.user_b = auth.uid() and m.user_a = profiles.id))));
create policy "insert own profile" on profiles for insert to authenticated
  with check (id = auth.uid() and not is_verified and status = 'active');
create policy "update own profile" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Users may not mark themselves verified or un-ban themselves. A column-level
-- REVOKE does nothing while the table-level grant exists, so revoke the table
-- grant and re-grant only the editable columns.
revoke update on profiles from authenticated;
grant update (display_name, birthdate, gender, bio, city, state, fitness_level,
              training_times, last_active_at)
  on profiles to authenticated;

create policy "own location" on user_locations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own modes" on profile_modes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read own or approved photos" on photos for select to authenticated
  using (user_id = auth.uid() or moderation = 'approved');
create policy "add own photos" on photos for insert to authenticated
  with check (user_id = auth.uid() and moderation = 'pending'
              and split_part(storage_path, '/', 1) = auth.uid()::text);
create policy "delete own photos" on photos for delete to authenticated
  using (user_id = auth.uid());

create policy "activities are public" on activities for select using (true);

create policy "read own or matched activities" on profile_activities for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from matches m
    where m.unmatched_at is null and auth.uid() in (m.user_a, m.user_b)
      and profile_activities.user_id in (m.user_a, m.user_b)));
create policy "manage own activities" on profile_activities for insert to authenticated
  with check (user_id = auth.uid());
create policy "remove own activities" on profile_activities for delete to authenticated
  using (user_id = auth.uid());

-- Swipes: you only ever see your own outgoing swipes, so nobody can find out
-- who passed on them. Mutual-like detection happens in the trigger above.
create policy "read own swipes" on swipes for select to authenticated
  using (swiper_id = auth.uid());
create policy "swipe as yourself" on swipes for insert to authenticated
  with check (swiper_id = auth.uid() and not is_blocked(swiper_id, swiped_id));

create policy "read own matches" on matches for select to authenticated
  using (auth.uid() in (user_a, user_b));

create policy "participants read messages" on messages for select to authenticated
  using (exists (select 1 from matches m
                 where m.id = match_id and auth.uid() in (m.user_a, m.user_b)));
create policy "participants send messages" on messages for insert to authenticated
  with check (
    sender_id = auth.uid() and read_at is null and exists (
      select 1 from matches m
      where m.id = match_id and m.unmatched_at is null
        and auth.uid() in (m.user_a, m.user_b)
        and not is_blocked(m.user_a, m.user_b)));

create policy "own blocks" on blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy "file reports" on reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- ─── RPC: unmatch, mark read ─────────────────────────────────────────────────

create function unmatch(p_match_id uuid) returns void
language sql security definer set search_path = public as $$
  update matches set unmatched_at = now(), unmatched_by = auth.uid()
  where id = p_match_id and auth.uid() in (user_a, user_b) and unmatched_at is null;
$$;

create function mark_match_read(p_match_id uuid) returns void
language sql security definer set search_path = public as $$
  update messages msg set read_at = now()
  from matches m
  where m.id = p_match_id and msg.match_id = m.id
    and auth.uid() in (m.user_a, m.user_b)
    and msg.sender_id <> auth.uid() and msg.read_at is null;
$$;

-- ─── RPC: discovery feed ─────────────────────────────────────────────────────
-- Returns people near the caller who fit BOTH sides' age, distance and gender
-- preferences, excluding anyone already swiped, anyone who passed on the
-- caller, blocked users, and profiles without an approved photo.
-- Ranked by shared activities, overlapping training times, recency, distance.

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
  photo_paths        text[]
)
language sql stable security definer
set search_path = public, extensions as $$
  with me as (
    select p.id, p.gender, p.training_times,
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
      -- mutual distance
      and st_dwithin(l.location, me.location, pm.max_distance_mi * 1609.34)
      -- mutual age
      and date_part('year', age(p.birthdate)) between me.min_age and me.max_age
      and me.age between pm.min_age and pm.max_age
      -- mutual gender preference (empty array = open to everyone)
      and (cardinality(me.interested_in) = 0 or p.gender = any(me.interested_in))
      and (cardinality(pm.interested_in) = 0 or me.gender = any(pm.interested_in))
      -- already swiped by me (like or pass)
      and not exists (select 1 from swipes s
                      where s.swiper_id = me.id and s.swiped_id = p.id and s.mode = p_mode)
      -- they passed on me: don't waste my likes
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
         coalesce(ph.paths, '{}')
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
    + c.time_overlap * 4                           -- same training schedule
    + case when c.liked_me then 6 else 0 end       -- quietly surface likely matches
    + case when c.last_active_at > now() - interval '3 days' then 5 else 0 end
    - c.meters / 1609.34 / 5                       -- -1 point per 5 miles
    desc,
    c.id                                           -- stable tiebreak
  limit least(p_limit, 50);
$$;

revoke execute on function get_discovery(app_mode, int) from public, anon;
grant  execute on function get_discovery(app_mode, int) to authenticated;

-- ─── REALTIME ────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table matches;

-- ─── STORAGE: private photos bucket ──────────────────────────────────────────
-- Path convention: <user_id>/<uuid>.<ext>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete from own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "read own or approved photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.photos p
               where p.storage_path = name and p.moderation = 'approved')));

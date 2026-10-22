-- Super Likes, Hinge-style prompts, and liking a photo/prompt with a comment.
--
-- • Super Like ("really interested"): 1 per rolling 24 hours, per mode.
--   It is still a like (it counts toward the 10-per-6h selection and creates
--   a match when mutual), flagged is_super.
-- • Prompts: up to 3 short Q&As per profile.
-- • A like can point at one photo or one prompt and carry a comment. The
--   recipient sees it under "Likes" before any match. If they like back, the
--   comment(s) open the conversation as the first chat messages.
-- • Liking back someone who already liked you is free: no selection pick spent.

-- ─── Prompts ─────────────────────────────────────────────────────────────────

create table profile_prompts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles on delete cascade,
  prompt_key  text not null check (prompt_key in (
                'sunday_workout', 'gym_hot_take', 'post_workout', 'training_for',
                'gets_me_moving', 'first_workout', 'starting_out', 'green_flag')),
  answer      text not null check (char_length(btrim(answer)) between 1 and 200),
  position    smallint not null default 0,
  unique (user_id, prompt_key)
);
create index profile_prompts_user_idx on profile_prompts (user_id, position);

alter table profile_prompts enable row level security;
create policy "manage own prompts" on profile_prompts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "read matched prompts" on profile_prompts for select to authenticated
  using (exists (
    select 1 from matches m
    where m.unmatched_at is null and auth.uid() in (m.user_a, m.user_b)
      and profile_prompts.user_id in (m.user_a, m.user_b)));

-- ─── Swipe extras ────────────────────────────────────────────────────────────

alter table swipes
  add column is_super        boolean not null default false,
  add column comment         text check (char_length(comment) <= 280),
  add column liked_photo_id  uuid references photos on delete set null,
  add column liked_prompt_id uuid references profile_prompts on delete set null,
  -- Only likes carry extras; a like targets at most one item.
  add constraint swipes_extras_only_on_like check (
    action = 'like' or (not is_super and comment is null and liked_photo_id is null and liked_prompt_id is null)),
  add constraint swipes_one_liked_item check (liked_photo_id is null or liked_prompt_id is null);

-- The liked photo/prompt must belong to the person being liked.
create function validate_swipe_extras() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.comment := nullif(btrim(new.comment), '');
  if new.liked_photo_id is not null and not exists (
       select 1 from photos where id = new.liked_photo_id and user_id = new.swiped_id and moderation = 'approved') then
    raise exception 'invalid_liked_photo';
  end if;
  if new.liked_prompt_id is not null and not exists (
       select 1 from profile_prompts where id = new.liked_prompt_id and user_id = new.swiped_id) then
    raise exception 'invalid_liked_prompt';
  end if;
  return new;
end $$;

create trigger swipe_extras_valid before insert on swipes
for each row execute function validate_swipe_extras();

-- ─── Super Like limit: 1 per rolling 24h per mode ────────────────────────────

create function superlike_window() returns interval language sql immutable as $$ select interval '24 hours' $$;

create function enforce_superlike_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_super then return new; end if;
  -- Serialize per user+mode; the check below then sees any committed Super Like.
  perform pg_advisory_xact_lock(hashtext('super' || new.swiper_id::text || new.mode::text));
  if exists (select 1 from swipes
             where swiper_id = new.swiper_id and mode = new.mode and is_super
               and created_at > now() - superlike_window()) then
    raise exception 'superlike_limit_reached';
  end if;
  return new;
end $$;

create trigger swipe_superlike before insert on swipes
for each row execute function enforce_superlike_limit();

create function get_super_quota(p_mode app_mode)
returns table (remaining int, resets_at timestamptz)
language sql stable security definer set search_path = public as $$
  select case when last_super is null then 1 else 0 end,
         last_super + superlike_window()
  from (select max(created_at) as last_super from swipes
        where swiper_id = auth.uid() and mode = p_mode and is_super
          and created_at > now() - superlike_window()) s;
$$;

-- ─── Selection quota: responding to someone who liked you is free ────────────

create or replace function enforce_swipe_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  w swipe_windows;
begin
  -- Replying to an incoming like (from the Likes tab or the deck) isn't browsing.
  if exists (select 1 from swipes s
             where s.swiper_id = new.swiped_id and s.swiped_id = new.swiper_id
               and s.mode = new.mode and s.action = 'like') then
    return new;
  end if;

  insert into swipe_windows (user_id, mode, started_at, used)
  values (new.swiper_id, new.mode, now(), 0)
  on conflict (user_id, mode) do nothing;

  select * into w from swipe_windows
  where user_id = new.swiper_id and mode = new.mode
  for update;

  if now() >= w.started_at + swipe_window() then
    w.started_at := now();
    w.used := 0;
  end if;

  if w.used >= swipe_limit() then
    raise exception 'swipe_limit_reached'
      using hint = (w.started_at + swipe_window())::text;
  end if;

  update swipe_windows
  set started_at = w.started_at, used = w.used + 1
  where user_id = new.swiper_id and mode = new.mode;

  return new;
end $$;

-- ─── Messages: like comments open the conversation ───────────────────────────

alter table messages
  add column kind    text not null default 'text' check (kind in ('text', 'like_comment')),
  add column context jsonb;

-- A like with no comment still appears (as "liked your photo"), so allow an empty body for it.
alter table messages drop constraint messages_body_check;
alter table messages add constraint messages_body_check check (
  char_length(body) <= 2000 and (kind = 'like_comment' or char_length(btrim(body)) >= 1));

-- Clients may only send plain text; like_comment rows come from the match trigger.
drop policy "participants send messages" on messages;
create policy "participants send messages" on messages for insert to authenticated
  with check (
    sender_id = auth.uid() and read_at is null and kind = 'text' and context is null
    and exists (
      select 1 from matches m
      where m.id = match_id and m.unmatched_at is null
        and auth.uid() in (m.user_a, m.user_b)
        and not is_blocked(m.user_a, m.user_b)));

create or replace function handle_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_match uuid;
begin
  if new.action <> 'like' then return new; end if;

  perform pg_advisory_xact_lock(hashtext(
    least(new.swiper_id, new.swiped_id)::text ||
    greatest(new.swiper_id, new.swiped_id)::text || new.mode::text));

  if exists (select 1 from swipes
             where swiper_id = new.swiped_id and swiped_id = new.swiper_id
               and mode = new.mode and action = 'like') then
    insert into matches (user_a, user_b, mode)
    values (least(new.swiper_id, new.swiped_id),
            greatest(new.swiper_id, new.swiped_id), new.mode)
    on conflict do nothing
    returning id into v_match;

    -- Seed the chat with each side's like (comment, liked photo/prompt, super).
    if v_match is not null then
      insert into messages (client_id, match_id, sender_id, body, kind, context, created_at)
      select gen_random_uuid(), v_match, s.swiper_id, coalesce(s.comment, ''), 'like_comment',
             jsonb_strip_nulls(jsonb_build_object(
               'super', s.is_super,
               'photo_id', s.liked_photo_id,
               'prompt_key', pp.prompt_key,
               'prompt_answer', pp.answer)),
             s.created_at
      from swipes s
      left join profile_prompts pp on pp.id = s.liked_prompt_id
      where s.mode = new.mode and s.action = 'like'
        and ((s.swiper_id = new.swiper_id and s.swiped_id = new.swiped_id)
          or (s.swiper_id = new.swiped_id and s.swiped_id = new.swiper_id))
        and (s.comment is not null or s.liked_photo_id is not null
          or s.liked_prompt_id is not null or s.is_super)
      order by s.created_at;
    end if;
  end if;
  return new;
end $$;

-- ─── Shared card media (internal helper for the definer RPCs below) ──────────

create function profile_card_media(p_viewer uuid, p_user uuid)
returns table (shared_activities text[], other_activities text[], photo_paths text[], photo_ids uuid[], prompts jsonb)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select array_agg(a.name order by a.name)
              from profile_activities pa join activities a on a.id = pa.activity_id
              where pa.user_id = p_user
                and exists (select 1 from profile_activities v
                            where v.user_id = p_viewer and v.activity_id = pa.activity_id)), '{}'),
    coalesce((select array_agg(a.name order by a.name)
              from profile_activities pa join activities a on a.id = pa.activity_id
              where pa.user_id = p_user
                and not exists (select 1 from profile_activities v
                                where v.user_id = p_viewer and v.activity_id = pa.activity_id)), '{}'),
    coalesce((select array_agg(storage_path order by position, id)
              from photos where user_id = p_user and moderation = 'approved'), '{}'),
    coalesce((select array_agg(id order by position, id)
              from photos where user_id = p_user and moderation = 'approved'), '{}'),
    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'key', prompt_key, 'answer', answer) order by position)
              from profile_prompts where user_id = p_user), '[]'::jsonb);
$$;
-- Not callable by clients (it would expose anyone's prompts/photos).
revoke execute on function profile_card_media(uuid, uuid) from public, anon, authenticated;

-- ─── Discovery: + photo ids, prompts, Super Like signal ──────────────────────

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
  photo_ids          uuid[],
  prompts            jsonb,
  goals              text[],
  shared_goals       text[],
  helps_beginners    boolean,
  super_liked_me     boolean
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
           ((coalesce(me.fitness_level, 3) <= 2 and p.helps_beginners)
             or (me.helps_beginners and coalesce(p.fitness_level, 3) <= 2)) as mentor_fit,
           exists (select 1 from swipes s
                   where s.swiper_id = p.id and s.swiped_id = me.id
                     and s.mode = p_mode and s.action = 'like') as liked_me,
           exists (select 1 from swipes s
                   where s.swiper_id = p.id and s.swiped_id = me.id
                     and s.mode = p_mode and s.is_super) as c_super_liked_me
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
         m.shared_activities, m.other_activities, m.photo_paths, m.photo_ids, m.prompts,
         c.goals, c.c_shared_goals, c.helps_beginners, c.c_super_liked_me
  from candidates c
  cross join lateral profile_card_media(auth.uid(), c.id) m
  order by
      case when c.c_super_liked_me then 20 else 0 end  -- "really interested" goes to the top
    + cardinality(m.shared_activities) * 10
    + cardinality(c.c_shared_goals) * 6
    + case when c.mentor_fit then 8 else 0 end
    + c.time_overlap * 4
    + case when c.liked_me then 6 else 0 end
    + case when c.last_active_at > now() - interval '3 days' then 5 else 0 end
    - c.meters / 1609.34 / 5
    desc,
    c.id
  limit least(p_limit, 50);
$$;

revoke execute on function get_discovery(app_mode, int) from public, anon;
grant  execute on function get_discovery(app_mode, int) to authenticated;

-- ─── Likes received (Hinge-style "Likes you") ────────────────────────────────

create function get_likes_received(p_mode app_mode)
returns table (
  user_id              uuid,
  display_name         text,
  age                  int,
  gender               text,
  city                 text,
  state                text,
  bio                  text,
  headline             text,
  fitness_level        smallint,
  training_times       text[],
  is_verified          boolean,
  distance_mi          int,
  shared_activities    text[],
  other_activities     text[],
  photo_paths          text[],
  photo_ids            uuid[],
  prompts              jsonb,
  goals                text[],
  shared_goals         text[],
  helps_beginners      boolean,
  liked_at             timestamptz,
  is_super             boolean,
  comment              text,
  liked_photo_id       uuid,
  liked_prompt_key     text,
  liked_prompt_answer  text
)
language sql stable security definer
set search_path = public, extensions as $$
  select p.id, p.display_name, date_part('year', age(p.birthdate))::int, p.gender, p.city, p.state,
         p.bio, pm.headline, p.fitness_level, p.training_times, p.is_verified,
         greatest(1, coalesce(round(st_distance(l.location, ml.location) / 1609.34), 1))::int,
         m.shared_activities, m.other_activities, m.photo_paths, m.photo_ids, m.prompts,
         p.goals, array(select unnest(p.goals) intersect select unnest(me.goals)), p.helps_beginners,
         s.created_at, s.is_super, s.comment, s.liked_photo_id, pp.prompt_key, pp.answer
  from swipes s
  join profiles me on me.id = auth.uid()
  join profiles p on p.id = s.swiper_id
  join profile_modes pm on pm.user_id = p.id and pm.mode = p_mode and pm.is_active
  left join user_locations l on l.user_id = p.id
  left join user_locations ml on ml.user_id = me.id
  left join profile_prompts pp on pp.id = s.liked_prompt_id
  cross join lateral profile_card_media(me.id, p.id) m
  where s.swiped_id = me.id and s.mode = p_mode and s.action = 'like'
    and p.status = 'active'
    -- Already answered (liked back = match, or passed) → no longer pending.
    and not exists (select 1 from swipes mine
                    where mine.swiper_id = me.id and mine.swiped_id = p.id and mine.mode = p_mode)
    and not exists (select 1 from blocks b
                    where (b.blocker_id = me.id and b.blocked_id = p.id)
                       or (b.blocker_id = p.id and b.blocked_id = me.id))
  order by s.is_super desc, s.created_at desc
  limit 100;
$$;

revoke execute on function get_likes_received(app_mode) from public, anon;
grant  execute on function get_likes_received(app_mode) to authenticated;
revoke execute on function get_super_quota(app_mode) from public, anon;
grant  execute on function get_super_quota(app_mode) to authenticated;

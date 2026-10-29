-- Dating upgrades.
--
-- • Intentions ("Looking for"): what someone wants from dating, on their
--   Dating mode only. Shown on their card; when two people's intentions fit
--   together, the card says so and the feed ranks them higher.
-- • Conversation state on matches: who sent the last message, and a short
--   preview of it, so the Chats list can show "Your turn" and the last line
--   without loading every thread.

-- ─── Intentions ──────────────────────────────────────────────────────────────

alter table profile_modes
  add column intent text check (intent in (
    'life_partner', 'long_term', 'long_open', 'short_open', 'short_term', 'figuring_out')),
  add constraint profile_modes_intent_dating_only check (intent is null or mode = 'dating');

-- Intentions that fit together. Mirrors INTENT_FAMILY in src/lib/validation.ts.
create function intent_family(p_intent text) returns text
language sql immutable as $$
  select case p_intent
    when 'life_partner' then 'long'
    when 'long_term'    then 'long'
    when 'long_open'    then 'open'
    when 'short_open'   then 'open'
    when 'figuring_out' then 'open'
    when 'short_term'   then 'short'
  end
$$;

-- ─── Discovery: + intent, intent_aligned, and a ranking bonus for it ─────────

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
  super_liked_me     boolean,
  intent             text,
  intent_aligned     boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  with me as (
    select p.id, p.gender, p.training_times, p.goals, p.fitness_level, p.helps_beginners,
           date_part('year', age(p.birthdate))::int as age,
           l.location, pm.min_age, pm.max_age, pm.max_distance_mi, pm.interested_in, pm.intent
    from profiles p
    join user_locations l on l.user_id = p.id
    join profile_modes pm on pm.user_id = p.id and pm.mode = p_mode and pm.is_active
    where p.id = auth.uid() and p.status = 'active'
  ),
  candidates as (
    select p.*, pm.headline, pm.intent as c_intent,
           coalesce(intent_family(pm.intent) = intent_family(me.intent), false) as c_intent_aligned,
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
         c.goals, c.c_shared_goals, c.helps_beginners, c.c_super_liked_me,
         c.c_intent, c.c_intent_aligned
  from candidates c
  cross join lateral profile_card_media(auth.uid(), c.id) m
  order by
      case when c.c_super_liked_me then 20 else 0 end  -- "really interested" goes to the top
    + cardinality(m.shared_activities) * 10
    + case when c.c_intent_aligned then 8 else 0 end   -- wanting the same thing matters for dating
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

-- ─── Likes received: + intent, intent_aligned ────────────────────────────────

drop function get_likes_received(app_mode);

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
  liked_prompt_answer  text,
  intent               text,
  intent_aligned       boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  select p.id, p.display_name, date_part('year', age(p.birthdate))::int, p.gender, p.city, p.state,
         p.bio, pm.headline, p.fitness_level, p.training_times, p.is_verified,
         greatest(1, coalesce(round(st_distance(l.location, ml.location) / 1609.34), 1))::int,
         m.shared_activities, m.other_activities, m.photo_paths, m.photo_ids, m.prompts,
         p.goals, array(select unnest(p.goals) intersect select unnest(me.goals)), p.helps_beginners,
         s.created_at, s.is_super, s.comment, s.liked_photo_id, pp.prompt_key, pp.answer,
         pm.intent, coalesce(intent_family(pm.intent) = intent_family(mym.intent), false)
  from swipes s
  join profiles me on me.id = auth.uid()
  join profiles p on p.id = s.swiper_id
  join profile_modes pm on pm.user_id = p.id and pm.mode = p_mode and pm.is_active
  left join profile_modes mym on mym.user_id = me.id and mym.mode = p_mode
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

-- ─── Conversation state on matches ───────────────────────────────────────────
-- Written only by the message trigger (matches has no update policy).

alter table matches
  add column last_sender_id       uuid references profiles on delete set null,
  add column last_message_preview text check (char_length(last_message_preview) <= 140);

create or replace function touch_match() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update matches
     set last_message_at      = new.created_at,
         last_sender_id       = new.sender_id,
         -- A like with no comment has no text to preview; the app says what it was.
         last_message_preview = nullif(left(btrim(new.body), 140), '')
   where id = new.match_id;
  return new;
end $$;

-- Existing conversations: fill in from their latest message.
update matches m
   set last_sender_id = latest.sender_id,
       last_message_preview = nullif(left(btrim(latest.body), 140), '')
  from (select distinct on (match_id) match_id, sender_id, body
          from messages
         order by match_id, created_at desc, id desc) latest
 where latest.match_id = m.id;

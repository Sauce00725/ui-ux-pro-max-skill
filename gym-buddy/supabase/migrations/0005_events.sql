-- Events tab: run clubs, CrossFit, pickleball, open gyms… near you.
--
-- • Anyone can post an event; it starts 'pending' and is visible only to its
--   organizer until approved (moderation queue / admin).
-- • RSVPs are private by default. "Show me as going" is opt-in, and only
--   opted-in attendees appear in the attendee list.
-- • get_events() is the one query the tab uses: distance, date window,
--   activity and beginner-friendly filters, plus going / buddies-going counts.

create table events (
  id                uuid primary key default gen_random_uuid(),
  source            text not null default 'organizer'
                    check (source in ('organizer', 'seed', 'runsignup', 'city_feed')),
  external_id       text,
  organizer_id      uuid references profiles on delete set null,
  activity_id       smallint references activities,
  title             text not null check (char_length(btrim(title)) between 4 and 90),
  description       text check (char_length(description) <= 2000),
  starts_at         timestamptz not null,
  ends_at           timestamptz check (ends_at is null or ends_at > starts_at),
  venue_name        text not null check (char_length(btrim(venue_name)) between 2 and 90),
  address           text check (char_length(address) <= 160),
  city              text not null,
  state             char(2) not null,
  location          extensions.geography(point, 4326) not null,
  url               text check (url is null or url ~ '^https?://'),
  beginner_friendly boolean not null default false,
  cost_cents        int not null default 0 check (cost_cents between 0 and 100000),
  capacity          int check (capacity is null or capacity > 0),
  moderation        mod_status not null default 'pending',
  created_at        timestamptz not null default now(),
  unique (source, external_id)
);
create index events_geo_idx on events using gist (location);
create index events_time_idx on events (starts_at);
create index events_organizer_idx on events (organizer_id);

create table event_rsvps (
  event_id    uuid references events on delete cascade,
  user_id     uuid references profiles on delete cascade,
  show_me     boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_rsvps_user_idx on event_rsvps (user_id);

alter table events enable row level security;
alter table event_rsvps enable row level security;

create policy "read approved or own events" on events for select to authenticated
  using (moderation = 'approved' or organizer_id = auth.uid());
create policy "post events" on events for insert to authenticated
  with check (organizer_id = auth.uid() and source = 'organizer'
              and moderation = 'pending' and external_id is null);
create policy "cancel own events" on events for delete to authenticated
  using (organizer_id = auth.uid());

create policy "own rsvps" on event_rsvps for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RSVPs only to visible, not-yet-finished events, and never past capacity.
create function enforce_rsvp() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  e events;
begin
  select * into e from events where id = new.event_id for update;
  if e.id is null or (e.moderation <> 'approved' and e.organizer_id is distinct from new.user_id) then
    raise exception 'event_not_found';
  end if;
  if coalesce(e.ends_at, e.starts_at + interval '3 hours') < now() then
    raise exception 'event_over';
  end if;
  if e.capacity is not null and (select count(*) from event_rsvps where event_id = e.id) >= e.capacity then
    raise exception 'event_full';
  end if;
  return new;
end $$;

create trigger rsvp_guard before insert on event_rsvps
for each row execute function enforce_rsvp();

-- ─── Queries ─────────────────────────────────────────────────────────────────

create function get_events(
  p_radius_mi    int default 25,
  p_activity     text default null,          -- activity slug
  p_from         timestamptz default now(),
  p_to           timestamptz default now() + interval '30 days',
  p_beginner     boolean default false,
  p_event_id     uuid default null,          -- single-event lookup (detail page)
  p_limit        int default 60
)
returns table (
  id                uuid,
  title             text,
  description       text,
  starts_at         timestamptz,
  ends_at           timestamptz,
  venue_name        text,
  address           text,
  city              text,
  state             text,
  url               text,
  beginner_friendly boolean,
  cost_cents        int,
  capacity          int,
  activity_slug     text,
  activity_name     text,
  distance_mi       numeric,
  going_count       int,
  buddies_going     int,
  i_am_going        boolean,
  my_show_me        boolean,
  is_mine           boolean,
  moderation        mod_status,
  organizer_name    text
)
language sql stable security definer
set search_path = public, extensions as $$
  with me as (
    select p.id, l.location
    from profiles p left join user_locations l on l.user_id = p.id
    where p.id = auth.uid()
  )
  select e.id, e.title, e.description, e.starts_at, e.ends_at, e.venue_name, e.address,
         e.city, e.state, e.url, e.beginner_friendly, e.cost_cents, e.capacity,
         a.slug, a.name,
         round((st_distance(e.location, me.location) / 1609.34)::numeric, 1),
         (select count(*)::int from event_rsvps r where r.event_id = e.id),
         -- matched people (any mode) who opted in to showing they're going
         (select count(*)::int from event_rsvps r
           join matches m on m.unmatched_at is null
             and ((m.user_a = me.id and m.user_b = r.user_id) or (m.user_b = me.id and m.user_a = r.user_id))
           where r.event_id = e.id and r.show_me),
         exists (select 1 from event_rsvps r where r.event_id = e.id and r.user_id = me.id),
         coalesce((select r.show_me from event_rsvps r where r.event_id = e.id and r.user_id = me.id), false),
         e.organizer_id = me.id,
         e.moderation,
         (select o.display_name from profiles o where o.id = e.organizer_id)
  from events e
  cross join me
  left join activities a on a.id = e.activity_id
  where (e.moderation = 'approved' or e.organizer_id = me.id)
    and (p_event_id is null or e.id = p_event_id)
    and (p_event_id is not null or (
          me.location is not null
          and st_dwithin(e.location, me.location, least(p_radius_mi, 250) * 1609.34)
          and coalesce(e.ends_at, e.starts_at + interval '3 hours') >= greatest(p_from, now())
          and e.starts_at <= p_to
          and (p_activity is null or a.slug = p_activity)
          and (not p_beginner or e.beginner_friendly)))
    and not exists (select 1 from blocks b
                    where (b.blocker_id = me.id and b.blocked_id = e.organizer_id)
                       or (b.blocker_id = e.organizer_id and b.blocked_id = me.id))
  order by e.starts_at, st_distance(e.location, me.location)
  limit least(p_limit, 100);
$$;

-- Opted-in attendees for one event (never people who blocked you or you blocked).
create function get_event_attendees(p_event_id uuid)
returns table (user_id uuid, display_name text, photo_path text, is_match boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name,
         (select ph.storage_path from photos ph
           where ph.user_id = p.id and ph.moderation = 'approved' order by ph.position limit 1),
         exists (select 1 from matches m
                 where m.unmatched_at is null
                   and ((m.user_a = auth.uid() and m.user_b = p.id) or (m.user_b = auth.uid() and m.user_a = p.id)))
  from event_rsvps r
  join events e on e.id = r.event_id and (e.moderation = 'approved' or e.organizer_id = auth.uid())
  join profiles p on p.id = r.user_id and p.status = 'active'
  where r.event_id = p_event_id and r.show_me and p.id <> auth.uid()
    and not is_blocked(auth.uid(), p.id)
  order by 4 desc, r.created_at
  limit 30;
$$;

revoke execute on function get_events(int, text, timestamptz, timestamptz, boolean, uuid, int) from public, anon;
grant  execute on function get_events(int, text, timestamptz, timestamptz, boolean, uuid, int) to authenticated;
revoke execute on function get_event_attendees(uuid) from public, anon;
grant  execute on function get_event_attendees(uuid) to authenticated;

-- ─── Account controls (used by Settings) ─────────────────────────────────────

-- Pause hides you from every feed without deleting anything. (status itself
-- isn't client-writable, see 0001, so this goes through a narrow RPC.)
create function set_profile_paused(p_paused boolean) returns void
language sql security definer set search_path = public as $$
  update profiles
  set status = case when p_paused then 'paused' else 'active' end
  where id = auth.uid() and status <> 'banned';
$$;

-- unmatched_by had no delete rule, which could block deleting an account.
alter table matches drop constraint matches_unmatched_by_fkey,
  add constraint matches_unmatched_by_fkey foreign key (unmatched_by) references profiles on delete set null;

-- Deletes the auth user; profiles and everything hanging off them cascade.
-- (The client removes its storage objects first via the Storage API.)
create function delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function set_profile_paused(boolean) from public, anon;
grant  execute on function set_profile_paused(boolean) to authenticated;
revoke execute on function delete_my_account() from public, anon;
grant  execute on function delete_my_account() to authenticated;

-- The caller's own (already ~1 km rounded) coordinates, e.g. to post an event
-- "near me" without asking the browser for location again.
create function my_location() returns table (lat double precision, lng double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select st_y(location::geometry), st_x(location::geometry)
  from user_locations where user_id = auth.uid();
$$;
revoke execute on function my_location() from public, anon;
grant  execute on function my_location() to authenticated;

-- Settings can reorder photos. Only `position` is writable, so nobody can
-- approve their own photo by updating `moderation`.
create policy "reorder own photos" on photos for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on photos from authenticated;
grant update (position) on photos to authenticated;

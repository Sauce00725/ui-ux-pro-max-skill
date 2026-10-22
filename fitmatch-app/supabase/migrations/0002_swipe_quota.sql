-- Slow dating: 10 swipes (likes + passes) per 6-hour window, per mode.
--
-- A window opens on your first swipe and lasts 6 hours; when it expires the
-- next swipe opens a fresh one with a full 10. That gives each user a
-- "Daily Selection" that refills as a batch rather than one slot at a time.
--
-- Enforced in a BEFORE INSERT trigger so no client can bypass it.

create function swipe_limit() returns int language sql immutable as $$ select 10 $$;
create function swipe_window() returns interval language sql immutable as $$ select interval '6 hours' $$;

create table swipe_windows (
  user_id     uuid references profiles on delete cascade,
  mode        app_mode,
  started_at  timestamptz not null,
  used        smallint not null default 0,
  primary key (user_id, mode)
);

alter table swipe_windows enable row level security;
-- Read-only for the owner; only the trigger below writes.
create policy "read own window" on swipe_windows for select to authenticated
  using (user_id = auth.uid());

create function enforce_swipe_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  w swipe_windows;
begin
  insert into swipe_windows (user_id, mode, started_at, used)
  values (new.swiper_id, new.mode, now(), 0)
  on conflict (user_id, mode) do nothing;

  -- Row lock serializes concurrent swipes from multiple tabs/devices.
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

-- Runs before on_swipe (AFTER INSERT), so a rejected swipe never creates a match.
-- A duplicate swipe fails the primary key and rolls the counter back with it.
create trigger swipe_quota before insert on swipes
for each row execute function enforce_swipe_quota();

create function get_swipe_quota(p_mode app_mode)
returns table (remaining int, swipe_limit int, window_seconds int, resets_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    case when w.user_id is null or now() >= w.started_at + swipe_window()
         then swipe_limit()
         else greatest(0, swipe_limit() - w.used) end,
    swipe_limit(),
    extract(epoch from swipe_window())::int,
    -- null = no window open yet; the clock starts on the next swipe
    case when w.user_id is null or now() >= w.started_at + swipe_window()
         then null
         else w.started_at + swipe_window() end
  from (select auth.uid() as uid) me
  left join swipe_windows w on w.user_id = me.uid and w.mode = p_mode;
$$;

revoke execute on function get_swipe_quota(app_mode) from public, anon;
grant  execute on function get_swipe_quota(app_mode) to authenticated;

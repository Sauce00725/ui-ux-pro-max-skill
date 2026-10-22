-- Per-member allowance for message/profile translation (Spanish ↔ English).
-- Translation calls a paid API, so each member gets a rolling hourly budget of
-- translation requests. Cached translations don't count (see app/actions/translate.ts).

create function translation_limit() returns int language sql immutable as $$ select 120 $$;

create table translation_usage (
  user_id       uuid primary key references profiles on delete cascade,
  window_start  timestamptz not null,
  used          int not null default 0
);

-- No policies: rows are only read and written by the function below.
alter table translation_usage enable row level security;

-- Spends one translation request; raises 'translation_limit_reached' when the
-- hour's allowance is used up. Returns how many remain.
create function consume_translation_quota() returns int
language plpgsql security definer set search_path = public as $$
declare
  w translation_usage;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into translation_usage (user_id, window_start, used)
  values (auth.uid(), now(), 0)
  on conflict (user_id) do nothing;

  select * into w from translation_usage where user_id = auth.uid() for update;

  if now() >= w.window_start + interval '1 hour' then
    w.window_start := now();
    w.used := 0;
  end if;

  if w.used >= translation_limit() then
    raise exception 'translation_limit_reached';
  end if;

  update translation_usage set window_start = w.window_start, used = w.used + 1
  where user_id = auth.uid();

  return translation_limit() - w.used - 1;
end $$;

revoke execute on function consume_translation_quota() from public, anon;
grant  execute on function consume_translation_quota() to authenticated;

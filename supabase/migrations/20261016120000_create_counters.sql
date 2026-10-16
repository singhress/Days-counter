-- Days Counter: one saved count per signed-in user.
--
-- Each person can only read and write their own row (row level security).
-- The page saves through save_counter(), which keeps whichever copy of the
-- count changed most recently, so an old device can't overwrite a newer count.

create table if not exists public.counters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  days integer not null default 0 check (days between 0 and 1000000),
  best integer not null default 0 check (best between 0 and 1000000),
  -- When the count last changed, in milliseconds since 1970 (from the device)
  changed_ms bigint not null default 0 check (changed_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint counters_best_at_least_days check (best >= days)
);

comment on table public.counters is 'Days Counter: the saved day count for each user.';

alter table public.counters enable row level security;

drop policy if exists "Users can read their own counter" on public.counters;
create policy "Users can read their own counter"
  on public.counters for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own counter" on public.counters;
create policy "Users can create their own counter"
  on public.counters for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own counter" on public.counters;
create policy "Users can update their own counter"
  on public.counters for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Only signed-in users reach the table, and only through the policies above.
-- Grants are explicit because Supabase is ending automatic grants on new tables.
revoke all on table public.counters from anon, authenticated;
grant select, insert, update on table public.counters to authenticated;
grant select, insert, update, delete on table public.counters to service_role;

create or replace function public.counters_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.counters_touch_updated_at() from public, anon, authenticated;

drop trigger if exists counters_touch_updated_at on public.counters;
create trigger counters_touch_updated_at
  before update on public.counters
  for each row execute function public.counters_touch_updated_at();

-- Saves the signed-in user's count and returns what the account now holds.
-- A save older than the stored copy is ignored, and the stored copy comes back
-- so the device can catch up. Times from a device whose clock runs ahead are
-- capped at the server's clock, so a wrong clock can't block later saves.
create or replace function public.save_counter(p_days integer, p_best integer, p_changed_ms bigint)
returns public.counters
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_changed bigint := least(p_changed_ms, (extract(epoch from clock_timestamp()) * 1000)::bigint);
  v_row public.counters;
begin
  if v_user is null then
    raise exception 'Sign in to save your days' using errcode = '42501';
  end if;

  insert into public.counters as c (user_id, days, best, changed_ms)
  values (v_user, p_days, greatest(p_best, p_days), v_changed)
  on conflict (user_id) do update
    set days = excluded.days,
        best = greatest(c.best, excluded.best),
        changed_ms = excluded.changed_ms
    where c.changed_ms < excluded.changed_ms;

  select * into v_row from public.counters where user_id = v_user;
  return v_row;
end;
$$;

revoke all on function public.save_counter(integer, integer, bigint) from public, anon;
grant execute on function public.save_counter(integer, integer, bigint) to authenticated;

-- Follow-up to 20261016120000_create_counters.sql, kept separate so projects
-- that already ran that migration get these changes too. Safe to run twice.

-- Let the service role (dashboard tools, server code) manage the table once
-- Supabase stops granting access on new tables automatically
grant select, insert, update, delete on table public.counters to service_role;

-- The updated_at trigger function is only for the trigger, not for API calls
revoke all on function public.counters_touch_updated_at() from public, anon, authenticated;

-- Booking request identity and abuse protection.
-- The limiter is intentionally persisted in Postgres so concurrent requests
-- and multiple API instances share one authoritative account quota.

create table if not exists public.booking_create_attempts (
  id bigint generated always as identity primary key,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists booking_create_attempts_learner_created
  on public.booking_create_attempts(learner_id, created_at);

alter table public.booking_create_attempts enable row level security;
revoke all on table public.booking_create_attempts from public, anon, authenticated;

create or replace function public.assert_verified_booking_caller() returns uuid
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  confirmed_at timestamptz;
begin
  if uid is null or not exists(select 1 from public.profiles where id = uid) then
    raise insufficient_privilege;
  end if;
  select u.email_confirmed_at into confirmed_at from auth.users u where u.id = uid;
  if confirmed_at is null then
    raise exception 'EMAIL_VERIFICATION_REQUIRED' using errcode='P0001';
  end if;
  return uid;
end $$;

revoke all on function public.assert_verified_booking_caller() from public, anon, authenticated;

create or replace function public.consume_booking_create_attempt(p_learner_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
  burst_count bigint;
  daily_count bigint;
begin
  -- Serialize only this account's limiter checks. Hash collisions can only
  -- over-serialize unrelated accounts; they cannot weaken the quota.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('booking-create:' || p_learner_id::text, 0));
  delete from public.booking_create_attempts
   where learner_id = p_learner_id and created_at < now() - interval '24 hours';
  select count(*) into burst_count
    from public.booking_create_attempts
   where learner_id = p_learner_id and created_at >= now() - interval '10 minutes';
  select count(*) into daily_count
    from public.booking_create_attempts
   where learner_id = p_learner_id and created_at >= now() - interval '24 hours';
  if burst_count >= 10 or daily_count >= 30 then
    raise exception 'RATE_LIMITED' using errcode='P0001';
  end if;
  insert into public.booking_create_attempts(learner_id) values (p_learner_id);
end $$;

revoke all on function public.consume_booking_create_attempt(uuid) from public, anon, authenticated;

-- Internal functions are called by the authoritative Booking RPC only.

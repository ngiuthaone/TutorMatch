-- Tutoria sessions, bookings, booking history, reschedule requests, attendance
-- facts, and session history. Capacity is DERIVED from active Booking rows
-- (requested/confirmed), never stored. See
-- docs/agent-team/DECISIONS-CAPACITY-CONCURRENCY.md and
-- docs/agent-team/DESIGN-SUPABASE-PERSISTENCE-RLS.md.

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid,
  host_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','completed')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  min_participants int check (min_participants >= 0),
  max_participants int check (max_participants > 0),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (min_participants is null or max_participants is null or min_participants <= max_participants)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id),
  learner_id uuid not null references public.profiles(id),
  participant_count int not null default 1 check (participant_count >= 1),
  status text not null default 'requested' check (status in ('requested','confirmed','cancelled','rejected','completed')),
  rescheduled_from_session_id uuid references public.sessions(id),
  cancelled_reason text,
  cancelled_by text check (cancelled_by in ('attendee','host')),
  cancelled_by_session_id uuid references public.sessions(id),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- D9, interpretation B (active uniqueness): at most one requested/confirmed
-- booking per learner per session; terminal rows coexist with a later booking.
create unique index if not exists bookings_active_learner_session_unique
  on public.bookings(learner_id, session_id) where status in ('requested','confirmed');

-- Capacity sum / listing lookups.
create index if not exists bookings_session_status on public.bookings(session_id, status);
create index if not exists bookings_learner on public.bookings(learner_id);

create table if not exists public.booking_history (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor text not null check (actor in ('attendee','host')),
  at timestamptz not null,
  reason text,
  session_change_from uuid,
  session_change_to uuid,
  cancelled_by_session_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists booking_history_booking on public.booking_history(booking_id, at);

create table if not exists public.reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_session_id uuid not null references public.sessions(id),
  to_session_id uuid not null references public.sessions(id),
  requested_by text not null check (requested_by in ('attendee','host')),
  status text not null default 'requested' check (status in ('requested','accepted','rejected','cancelled')),
  reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  version bigint not null default 1 check (version > 0),
  check (from_session_id <> to_session_id)
);

-- At most one pending request per booking.
create unique index if not exists reschedule_pending_unique
  on public.reschedule_requests(booking_id) where status = 'requested';

create table if not exists public.attendance_facts (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id),
  outcome text not null check (outcome in ('attended','learner_no_show','host_no_show')),
  reported_by text not null check (reported_by in ('attendee','host')),
  at timestamptz not null,
  session_id uuid not null references public.sessions(id),
  prior_status text not null,
  source text,
  created_at timestamptz not null default now(),
  unique (booking_id, outcome, reported_by)
);

create index if not exists attendance_facts_booking on public.attendance_facts(booking_id, at);

create table if not exists public.session_history (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  change_type text not null check (change_type in ('created','rescheduled','cancelled','completed','capacity_changed')),
  by text not null check (by in ('host','system')),
  at timestamptz not null,
  from_start timestamptz,
  from_end timestamptz,
  to_start timestamptz,
  to_end timestamptz,
  cause text check (cause in ('host','minimum_not_met')),
  capacity_from int,
  capacity_to int,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists session_history_session on public.session_history(session_id, at);

-- updated_at maintenance, mirroring 0001.
create or replace function public.set_session_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function public.set_session_updated_at() from public, anon, authenticated;
drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at before update on public.sessions
for each row execute function public.set_session_updated_at();

create or replace function public.set_booking_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function public.set_booking_updated_at() from public, anon, authenticated;
drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at before update on public.bookings
for each row execute function public.set_booking_updated_at();

-- RLS enabled + fully revoked: all access flows through the 0005 security
-- definer functions, matching 0002's pattern for complex aggregates.
do $$ declare t text; begin foreach t in array array['sessions','bookings','booking_history','reschedule_requests','attendance_facts','session_history'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on table public.%I from public, anon, authenticated', t);
end loop; end $$;

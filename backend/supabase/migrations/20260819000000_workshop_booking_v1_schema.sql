-- Workshop booking V1: create offerings table, wire sessions.offering_id FK,
-- extend bookings pricing for flat_per_participant_v1, and add payment TTL
-- for workshop INSTANT bookings.

-- 1. Create offerings table
create table if not exists public.offerings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  offering_type text not null check (offering_type in ('tutor','workshop','class','event')),
  title text not null,
  description text,
  pricing_model text not null check (pricing_model in ('hourly_v1','flat_per_participant_v1')),
  price_per_participant_vnd bigint,
  hourly_rate_vnd bigint,
  currency text not null default 'VND' check (currency = 'VND'),
  booking_mode text not null default 'approval' check (booking_mode in ('approval','instant')),
  status text not null default 'draft' check (status in ('draft','published','unpublished')),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Pricing model constraints: hourly_v1 requires hourly_rate_vnd,
  -- flat_per_participant_v1 requires price_per_participant_vnd
  check (
    (pricing_model = 'hourly_v1' and hourly_rate_vnd is not null
     and price_per_participant_vnd is null)
    or
    (pricing_model = 'flat_per_participant_v1' and price_per_participant_vnd is not null
     and hourly_rate_vnd is null)
  )
);

-- 2. Add FK constraint to sessions.offering_id
-- (previously a dangling nullable UUID with no FK target)
alter table public.sessions
  add constraint sessions_offering_id_fk
  foreign key (offering_id) references public.offerings(id)
  on delete set null;

-- 3. Add pricing snapshot column for flat_per_participant_v1
-- (must be added BEFORE the CHECK constraint references it)
alter table public.bookings
  add column if not exists pricing_price_per_participant_vnd bigint;

comment on column public.bookings.pricing_price_per_participant_vnd
  is 'Price per participant snapshot from offering at booking creation time (flat_per_participant_v1 only)';

-- 4. Extend bookings pricing CHECK constraint for flat_per_participant_v1
-- (drop the existing hourly_v1-only constraint from 0008)
alter table public.bookings
  drop constraint if exists bookings_pricing_snapshot_check;

alter table public.bookings
  add constraint bookings_pricing_snapshot_check check (
    (pricing_amount_vnd is null and pricing_currency is null
     and pricing_hourly_rate_vnd is null and pricing_duration_minutes is null
     and pricing_price_per_participant_vnd is null
     and pricing_model is null and pricing_snapshotted_at is null)
    or
    (pricing_amount_vnd > 0 and pricing_currency = 'VND'
     and pricing_model is not null and pricing_snapshotted_at is not null
     and (
       (pricing_model = 'hourly_v1'
        and pricing_hourly_rate_vnd between 50000 and 10000000
        and pricing_duration_minutes > 0
        and pricing_price_per_participant_vnd is null)
       or
       (pricing_model = 'flat_per_participant_v1'
        and pricing_price_per_participant_vnd > 0
        and pricing_hourly_rate_vnd is null
        and pricing_duration_minutes is null)
     )
    )
  );

-- 5. Add updated_at trigger for offerings table
create or replace function public.set_offering_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function public.set_offering_updated_at() from public, anon, authenticated;
drop trigger if exists offerings_set_updated_at on public.offerings;
create trigger offerings_set_updated_at before update on public.offerings
for each row execute function public.set_offering_updated_at();

-- 6. RLS: enable + fully revoked (all access through security-definer RPCs)
alter table public.offerings enable row level security;
revoke all on table public.offerings from public, anon, authenticated;

-- 7. Indexes
create index if not exists idx_offerings_host_id on public.offerings(host_id);
create index if not exists idx_offerings_status on public.offerings(status);
create index if not exists idx_offerings_type on public.offerings(offering_type);

-- Index for minimum evaluation query (workshop sessions approaching cutoff)
create index if not exists idx_sessions_status_starts
  on public.sessions(status, starts_at)
  where status = 'scheduled';

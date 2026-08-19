-- Shared Booking Engine: offerings, host capability, generic read models,
-- generalized pricing, and participant quantity.
-- Adds atop 0001-0013 + 20260814073312-20260815150540. Nothing removed.

-- ─────────────────────────────────────────────────────────────────────
-- 1. OFFERINGS table
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.offerings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('tutor','workshop','class','event')),
  slug text not null,
  title text not null,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  description text,
  unit_price_vnd bigint,
  currency text not null default 'VND' check (currency = 'VND'),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  publication_status text not null default 'draft'
    check (publication_status in ('draft','published','unpublished')),
  published_at timestamptz,
  unpublished_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(title)) between 1 and 300),
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  check (
    (kind = 'tutor' and unit_price_vnd is null)
    or (kind in ('workshop','class','event') and unit_price_vnd >= 0)
  )
);

create unique index if not exists offerings_kind_slug_unique
  on public.offerings(kind, slug);
create index if not exists offerings_public_order
  on public.offerings(published_at desc, id desc)
  where publication_status = 'published';
create index if not exists offerings_creator
  on public.offerings(creator_id);

-- updated_at trigger
create or replace function public.set_offering_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function public.set_offering_updated_at() from public, anon, authenticated;
drop trigger if exists offerings_set_updated_at on public.offerings;
create trigger offerings_set_updated_at before update on public.offerings
for each row execute function public.set_offering_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 2. OFFERING_HOSTS table (capability/ownership model)
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.offering_hosts (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.offerings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null default 'host'
    check (capability in ('owner','host')),
  granted_at timestamptz not null default now(),
  granted_by uuid not null references public.profiles(id),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= granted_at)
);

create unique index if not exists offering_hosts_active_unique
  on public.offering_hosts(offering_id, user_id)
  where revoked_at is null;
create index if not exists offering_hosts_user
  on public.offering_hosts(user_id);
create index if not exists offering_hosts_offering
  on public.offering_hosts(offering_id);

-- ─────────────────────────────────────────────────────────────────────
-- 3. can_manage_offering() authorization function
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.can_manage_offering(
  actor_user_id uuid,
  p_offering_id uuid,
  required_capability text default 'host'
) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.offering_hosts oh
    where oh.offering_id = p_offering_id
      and oh.user_id = actor_user_id
      and oh.revoked_at is null
      and (
        oh.capability = 'owner'
        or (required_capability = 'host' and oh.capability in ('owner','host'))
      )
  ) or exists (
    select 1 from public.profiles p
    where p.id = actor_user_id and p.role = 'admin'
  )
$$;
revoke all on function public.can_manage_offering(uuid,uuid,text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 4. resolve_booking_pricing() server-authoritative pricing resolver
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.resolve_booking_pricing(
  p_session_id uuid,
  p_participant_count int
) returns table (
  amount_vnd bigint,
  pricing_model text,
  pricing_hourly_rate_vnd bigint,
  pricing_duration_minutes int,
  pricing_unit_price_vnd bigint,
  pricing_participant_count int,
  pricing_currency text
)
language plpgsql security definer set search_path = '' as $$
declare
  s public.sessions%rowtype;
  o public.offerings%rowtype;
  rate bigint;
  duration integer;
  unit_price bigint;
begin
  select * into s from public.sessions where id = p_session_id;
  if s.id is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  select * into o from public.offerings where id = s.offering_id;
  if o.id is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;

  if o.kind = 'tutor' then
    -- Hourly-rate derived pricing (existing Tutor policy)
    select tp.hourly_rate_vnd into rate
    from public.tutor_profiles tp where tp.user_id = s.host_id for share;
    if rate is null then raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023'; end if;
    duration := floor(extract(epoch from (s.ends_at - s.starts_at)) / 60)::int;
    if duration < 1 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
    amount_vnd := round((rate::numeric * duration::numeric) / 60)::bigint;
    if amount_vnd <= 0 then raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023'; end if;
    pricing_model := 'hourly_v1';
    pricing_hourly_rate_vnd := rate;
    pricing_duration_minutes := duration;
    pricing_unit_price_vnd := null;
    pricing_participant_count := p_participant_count;
    pricing_currency := 'VND';
  else
    -- Workshop / Class / Event: fixed per-participant price
    unit_price := o.unit_price_vnd;
    if unit_price is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
    -- unit_price_vnd = 0 is allowed (free offering)
    amount_vnd := unit_price * p_participant_count;
    pricing_model := 'fixed_v1';
    pricing_hourly_rate_vnd := null;
    pricing_duration_minutes := null;
    pricing_unit_price_vnd := unit_price;
    pricing_participant_count := p_participant_count;
    pricing_currency := 'VND';
  end if;

  return query select
    resolve_booking_pricing.amount_vnd,
    resolve_booking_pricing.pricing_model,
    resolve_booking_pricing.pricing_hourly_rate_vnd,
    resolve_booking_pricing.pricing_duration_minutes,
    resolve_booking_pricing.pricing_unit_price_vnd,
    resolve_booking_pricing.pricing_participant_count,
    resolve_booking_pricing.pricing_currency;
end $$;
revoke all on function public.resolve_booking_pricing(uuid,int) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Backfill: create tutor offerings for existing sessions
-- ─────────────────────────────────────────────────────────────────────

-- For each distinct host_id in sessions with offering_id IS NULL,
-- create a tutor-kind offering and link it.
with existing_hosts as (
  select distinct s.host_id
  from public.sessions s
  where s.offering_id is null
),
created_offerings as (
  insert into public.offerings(kind, slug, title, creator_id, unit_price_vnd, publication_status, published_at)
  select
    'tutor',
    'default-' || replace(h.host_id::text, '-', ''),
    'Tutor Sessions',
    h.host_id,
    null,
    'published',
    now()
  from existing_hosts h
  on conflict (kind, slug) do nothing
  returning id, creator_id
),
all_offerings as (
  select id, creator_id from created_offerings
  union
  select o.id, o.creator_id from public.offerings o
  join existing_hosts h on h.host_id = o.creator_id and o.kind = 'tutor' and o.slug = 'default-' || replace(h.host_id::text, '-', '')
)
-- Link sessions to their creator's tutor offering
update public.sessions s
set offering_id = ao.id
from all_offerings ao
where ao.creator_id = s.host_id and s.offering_id is null;

-- Create offering_hosts entries for tutor offerings (owner = creator)
insert into public.offering_hosts(offering_id, user_id, capability, granted_by)
select o.id, o.creator_id, 'owner', o.creator_id
from public.offerings o
where o.kind = 'tutor'
  and not exists (
    select 1 from public.offering_hosts oh
    where oh.offering_id = o.id and oh.user_id = o.creator_id and oh.revoked_at is null
  )
on conflict (offering_id, user_id) where revoked_at is null do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Add FK + NOT NULL to sessions.offering_id
-- ─────────────────────────────────────────────────────────────────────

-- Verify no NULLs remain (safety check)
do $$ declare null_count bigint; begin
  select count(*) into null_count from public.sessions where offering_id is null;
  if null_count > 0 then
    raise exception 'BACKFILL_INCOMPLETE: % sessions still have null offering_id', null_count;
  end if;
end $$;

do $$ begin
  alter table public.sessions
    add constraint sessions_offering_fk
    foreign key (offering_id) references public.offerings(id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- Only set NOT NULL if not already set
do $$ begin
  alter table public.sessions alter column offering_id set not null;
exception when null_value_not_allowed then null;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 7. Add pricing columns for fixed_v1 model to bookings
-- ─────────────────────────────────────────────────────────────────────

alter table public.bookings
  add column if not exists pricing_unit_price_vnd bigint,
  add column if not exists pricing_participant_count int;

-- Backfill pricing_participant_count for existing hourly_v1 bookings
-- (they always had participant_count = 1 for tutor sessions)
update public.bookings
set pricing_participant_count = participant_count
where pricing_model = 'hourly_v1' and pricing_participant_count is null;

-- Update pricing snapshot check constraint to support both models
alter table public.bookings drop constraint if exists bookings_pricing_snapshot_check;
alter table public.bookings add constraint bookings_pricing_snapshot_check check (
  (pricing_amount_vnd is null and pricing_currency is null and pricing_hourly_rate_vnd is null
   and pricing_duration_minutes is null and pricing_model is null and pricing_snapshotted_at is null
   and pricing_unit_price_vnd is null and pricing_participant_count is null)
  or (pricing_model = 'hourly_v1' and pricing_amount_vnd > 0 and pricing_currency = 'VND'
   and pricing_hourly_rate_vnd between 50000 and 10000000 and pricing_duration_minutes > 0
   and pricing_unit_price_vnd is null and pricing_participant_count is not null
   and pricing_snapshotted_at is not null)
  or (pricing_model = 'fixed_v1' and pricing_amount_vnd >= 0 and pricing_currency = 'VND'
   and pricing_unit_price_vnd >= 0 and pricing_participant_count >= 1
   and pricing_hourly_rate_vnd is null and pricing_duration_minutes is null
   and pricing_snapshotted_at is not null)
);

-- ─────────────────────────────────────────────────────────────────────
-- 8. Update assert_host_of_session() with offering_hosts fallback
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.assert_host_of_session(sid uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); sid_offering uuid;
begin
  if uid is null then raise insufficient_privilege; end if;
  -- Fast path: direct host_id match (preserves existing performance)
  if exists(select 1 from public.sessions where id = sid and host_id = uid) then
    return uid;
  end if;
  -- Fallback: offering-level host capability
  select offering_id into sid_offering from public.sessions where id = sid;
  if sid_offering is not null and public.can_manage_offering(uid, sid_offering, 'host') then
    return uid;
  end if;
  raise insufficient_privilege;
end $$;
revoke all on function public.assert_host_of_session(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 9. Update create_session() — require offeringId, use can_manage_offering
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.create_session(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_attendee_caller();
  p_offering_id uuid;
  o public.offerings%rowtype;
  sid uuid := gen_random_uuid();
  starts_at timestamptz; ends_at timestamptz; min_p int; max_p int;
  p_host_id uuid;
begin
  if payload is null or jsonb_typeof(payload) <> 'object'
     or exists(select 1 from jsonb_object_keys(payload) k
               where k not in ('offeringId','startsAt','endsAt','minParticipants','maxParticipants','hostId'))
  then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;

  -- offeringId is now REQUIRED
  if not payload ? 'offeringId' or payload->>'offeringId' is null or payload->>'offeringId' = '' then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  begin
    p_offering_id := (payload->>'offeringId')::uuid;
  exception when others then raise exception 'INVALID_TRANSITION' using errcode='22023';
  end;

  -- Offering must exist and be published
  select * into o from public.offerings where id = p_offering_id;
  if o.id is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if o.publication_status <> 'published' then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;

  -- Caller must have host capability on this offering
  if not public.can_manage_offering(uid, p_offering_id, 'host') then
    raise insufficient_privilege;
  end if;

  -- Parse optional fields
  begin
    starts_at := (payload->>'startsAt')::timestamptz;
    ends_at := (payload->>'endsAt')::timestamptz;
    if payload ? 'minParticipants' then min_p := (payload->>'minParticipants')::int; if min_p < 0 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if; else min_p := null; end if;
    if payload ? 'maxParticipants' then max_p := (payload->>'maxParticipants')::int; if max_p <= 0 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if; else max_p := null; end if;
  exception when others then raise exception 'INVALID_TRANSITION' using errcode='22023'; end;

  if ends_at <= starts_at then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if min_p is not null and max_p is not null and min_p > max_p then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;

  -- Determine host_id: for tutor kind, must be the tutor themselves
  -- For workshop/class/event, accept hostId from payload if provided, else default to caller
  if o.kind = 'tutor' then
    p_host_id := uid;
  elsif payload ? 'hostId' and payload->>'hostId' <> '' then
    begin
      p_host_id := (payload->>'hostId')::uuid;
    exception when others then raise exception 'INVALID_TRANSITION' using errcode='22023';
    end;
    -- Validate that the specified host has capability on this offering
    if not public.can_manage_offering(p_host_id, p_offering_id, 'host') then
      raise exception 'INVALID_TRANSITION' using errcode='22023';
    end if;
  else
    p_host_id := uid;
  end if;

  insert into public.sessions(id, offering_id, host_id, starts_at, ends_at, min_participants, max_participants)
  values (sid, p_offering_id, p_host_id, starts_at, ends_at, min_p, max_p);
  insert into public.session_history(session_id, change_type, by, at) values (sid, 'created', 'host', now());
  return public.session_json(sid);
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 10. Update create_booking() — use resolve_booking_pricing()
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.create_booking(session_id uuid, participant_count int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid; s public.sessions%rowtype; o public.offerings%rowtype;
  bid uuid := gen_random_uuid(); reserved bigint;
  pricing record;
begin
  if participant_count is null or participant_count < 1 then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  uid := public.assert_verified_booking_caller();
  perform public.consume_booking_create_attempt(uid);
  select * into s from public.sessions where id = session_id for update;
  if s.id is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  if s.status <> 'scheduled' then raise exception 'SESSION_NOT_OPEN' using errcode='22023'; end if;
  if s.host_id = uid then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;

  -- Resolve offering kind
  select * into o from public.offerings where id = s.offering_id;
  if o.id is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;

  -- Tutor kind: participant_count must be 1
  if o.kind = 'tutor' and participant_count <> 1 then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  -- Server-authoritative pricing
  select * into pricing from public.resolve_booking_pricing(session_id, participant_count);

  -- Capacity check (uses participant_count)
  reserved := public.session_hard_reserved(session_id);
  if s.max_participants is not null and reserved + participant_count > s.max_participants then
    raise exception 'INSUFFICIENT_CAPACITY' using errcode='22023';
  end if;

  begin
    insert into public.bookings(id, session_id, learner_id, participant_count, status,
      pricing_amount_vnd, pricing_currency, pricing_hourly_rate_vnd, pricing_duration_minutes,
      pricing_model, pricing_snapshotted_at, pricing_unit_price_vnd, pricing_participant_count)
    values (bid, session_id, uid, participant_count, 'requested',
      pricing.amount_vnd, pricing.pricing_currency, pricing.pricing_hourly_rate_vnd,
      pricing.pricing_duration_minutes, pricing.pricing_model, now(),
      pricing.pricing_unit_price_vnd, pricing.pricing_participant_count);
  exception when unique_violation then
    raise exception 'BOOKING_CONFLICT' using errcode='23505';
  end;

  insert into public.booking_history(booking_id, from_status, to_status, actor, at)
  values (bid, null, 'requested', 'attendee', now());
  perform public.insert_outbox_event('BOOKING_REQUESTED', 'booking', bid, 1,
    jsonb_build_object('bookingId', bid, 'sessionId', session_id, 'participantCount', participant_count,
      'amountVnd', pricing.amount_vnd, 'currency', pricing.pricing_currency));
  return public.booking_json(bid);
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 11. Update booking_read_json() — generic host/offering read model
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.booking_read_json(bid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object(
  'id', b.id,
  'sessionId', b.session_id,
  'status', b.status,
  'participantCount', b.participant_count,
  'rescheduledFromSessionId', b.rescheduled_from_session_id,
  'cancelledReason', b.cancelled_reason,
  'cancelledBy', b.cancelled_by,
  'cancelledBySessionId', b.cancelled_by_session_id,
  'version', b.version,
  'createdAt', b.created_at,
  'updatedAt', b.updated_at,
  'pricing', case when b.pricing_amount_vnd is null then null else jsonb_build_object(
    'amountVnd', b.pricing_amount_vnd,
    'currency', b.pricing_currency,
    'hourlyRateVnd', b.pricing_hourly_rate_vnd,
    'durationMinutes', b.pricing_duration_minutes,
    'unitPriceVnd', b.pricing_unit_price_vnd,
    'participantCountPricing', b.pricing_participant_count,
    'model', b.pricing_model,
    'snapshottedAt', b.pricing_snapshotted_at
  ) end,
  'session', public.session_json(b.session_id),
  'offering', jsonb_build_object(
    'id', o.id,
    'kind', o.kind,
    'title', o.title
  ),
  'host', jsonb_build_object(
    'id', s.host_id,
    'displayName', case
      when o.kind = 'tutor' then tp.display_name
      else p_host.name
    end
  ),
  'tutor', case when o.kind = 'tutor' then jsonb_build_object(
    'id', tp.id,
    'displayName', tp.display_name
  ) else null end,
  'payment', case when p.id is null then null else jsonb_build_object(
    'id', p.id,
    'status', p.status,
    'amountVnd', p.amount_vnd,
    'currency', p.currency,
    'refundedAmountVnd', p.refunded_amount_vnd,
    'paidAt', p.paid_at
  ) end,
  'paymentRequired', b.pricing_amount_vnd is not null,
  'paymentReady', b.status = 'requested' and s.status = 'scheduled'
    and exists(select 1 from public.booking_approvals a where a.booking_id = b.id and a.revoked_at is null and (a.expires_at is null or a.expires_at > now()))
    and coalesce(p.status, 'pending') not in ('succeeded', 'refunded'),
  'paymentRetryAllowed', coalesce(p.status, 'pending') in ('pending', 'failed'),
  'canHostAccept', s.host_id = auth.uid() and b.status = 'requested' and s.status = 'scheduled',
  'canHostReject', s.host_id = auth.uid() and b.status = 'requested' and s.status = 'scheduled',
  'canLearnerCancel', b.learner_id = auth.uid() and b.status in ('requested', 'confirmed'),
  'canLearnerRequestReschedule', b.learner_id = auth.uid() and b.status in ('requested', 'confirmed') and s.status = 'scheduled',
  'refund', case when p.id is null then null else jsonb_build_object(
    'status', case when exists(select 1 from public.refunds r where r.payment_id = p.id and r.status in ('obligation','pending','ambiguous')) then 'processing'
                   when exists(select 1 from public.refunds r where r.payment_id = p.id and r.status = 'succeeded') then 'succeeded'
                   else null end,
    'refundedAmountVnd', p.refunded_amount_vnd,
    'obligationCount', (select count(*) from public.refunds r where r.payment_id = p.id)
  ) end
)
from public.bookings b
join public.sessions s on s.id = b.session_id
join public.offerings o on o.id = s.offering_id
left join public.tutor_profiles tp on tp.user_id = s.host_id and o.kind = 'tutor'
left join public.profiles p_host on p_host.id = s.host_id and o.kind != 'tutor'
left join public.payments p on p.booking_id = b.id
where b.id = bid
$$;

revoke all on function public.booking_read_json(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 12. Update list_bookable_sessions() — join through offerings
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.list_bookable_sessions(
  p_tutor_profile_id uuid default null,
  p_offering_id uuid default null,
  p_kind text default null
) returns jsonb
language sql stable security definer set search_path = '' as $$
select coalesce(jsonb_agg(
  jsonb_build_object(
    'offering', jsonb_build_object('id', o.id, 'kind', o.kind, 'title', o.title),
    'host', jsonb_build_object('id', s.host_id, 'displayName', coalesce(tp.display_name, p_host.name)),
    'tutorProfileId', tp.id,
    'hourlyRateVnd', tp.hourly_rate_vnd,
    'unitPriceVnd', o.unit_price_vnd,
    'currency', coalesce(tp.currency, o.currency),
    'pricingModel', case when o.kind = 'tutor' then 'hourly_v1' else 'fixed_v1' end
  ) || public.session_json(s.id) order by s.starts_at, s.id
), '[]'::jsonb)
from public.sessions s
join public.offerings o on o.id = s.offering_id and o.publication_status = 'published'
left join public.tutor_profiles tp on tp.user_id = s.host_id and o.kind = 'tutor' and tp.publication_status = 'published'
left join public.profiles p_host on p_host.id = s.host_id and o.kind != 'tutor'
where s.status = 'scheduled'
  and (p_tutor_profile_id is null or tp.id = p_tutor_profile_id)
  and (p_offering_id is null or s.offering_id = p_offering_id)
  and (p_kind is null or o.kind = p_kind)
$$;

revoke all on function public.list_bookable_sessions(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.list_bookable_sessions(uuid,uuid,text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 13. Update get_bookable_session() — join through offerings
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.get_bookable_session(p_session_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object(
  'offering', jsonb_build_object('id', o.id, 'kind', o.kind, 'title', o.title),
  'host', jsonb_build_object('id', s.host_id, 'displayName', coalesce(tp.display_name, p_host.name)),
  'tutorProfileId', tp.id,
  'hourlyRateVnd', tp.hourly_rate_vnd,
  'unitPriceVnd', o.unit_price_vnd,
  'currency', coalesce(tp.currency, o.currency),
  'pricingModel', case when o.kind = 'tutor' then 'hourly_v1' else 'fixed_v1' end
) || public.session_json(s.id)
from public.sessions s
join public.offerings o on o.id = s.offering_id and o.publication_status = 'published'
left join public.tutor_profiles tp on tp.user_id = s.host_id and o.kind = 'tutor' and tp.publication_status = 'published'
left join public.profiles p_host on p_host.id = s.host_id and o.kind != 'tutor'
where s.id = p_session_id and s.status = 'scheduled'
$$;

revoke all on function public.get_bookable_session(uuid) from public, anon, authenticated;
grant execute on function public.get_bookable_session(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 14. Create get_my_host_bookings() — replaces get_my_tutor_bookings
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.get_my_host_bookings() returns jsonb
language sql stable security definer set search_path = '' as $$
select coalesce(jsonb_agg(public.booking_read_json(b.id) order by b.created_at desc), '[]'::jsonb)
from public.bookings b
join public.sessions s on s.id = b.session_id
join public.offerings o on o.id = s.offering_id
where public.can_manage_offering(auth.uid(), o.id, 'host')
$$;

revoke all on function public.get_my_host_bookings() from public, anon, authenticated;
grant execute on function public.get_my_host_bookings() to authenticated;

-- Keep get_my_tutor_bookings as a backward-compatible alias
create or replace function public.get_my_tutor_bookings() returns jsonb
language sql stable security definer set search_path = '' as $$
select public.get_my_host_bookings()
$$;

revoke all on function public.get_my_tutor_bookings() from public, anon, authenticated;
grant execute on function public.get_my_tutor_bookings() to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 15. Update get_booking() and get_my_bookings() — use booking_read_json
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.get_my_bookings() returns jsonb
language sql stable security definer set search_path = '' as $$
select coalesce(jsonb_agg(public.booking_read_json(b.id) order by b.created_at desc), '[]'::jsonb)
from public.bookings b where b.learner_id = auth.uid()
$$;

create or replace function public.get_booking(bid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise insufficient_privilege; end if;
  if not exists(select 1 from public.bookings where id = bid and learner_id = uid)
     and not exists(select 1 from public.bookings b join public.sessions s on s.id = b.session_id where b.id = bid and s.host_id = uid)
  then raise insufficient_privilege; end if;
  return public.booking_read_json(bid);
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 16. RLS + Grants for new tables
-- ─────────────────────────────────────────────────────────────────────

do $$ declare t text; begin foreach t in array array['offerings','offering_hosts'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on table public.%I from public, anon, authenticated', t);
end loop; end $$;

-- Revoke and re-grant affected functions
revoke all on function public.list_bookable_sessions(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.get_bookable_session(uuid) from public, anon, authenticated;
revoke all on function public.get_my_host_bookings() from public, anon, authenticated;
revoke all on function public.get_my_tutor_bookings() from public, anon, authenticated;
revoke all on function public.get_my_bookings() from public, anon, authenticated;
revoke all on function public.get_booking(uuid) from public, anon, authenticated;
revoke all on function public.create_session(jsonb) from public, anon, authenticated;
revoke all on function public.create_booking(uuid, int) from public, anon, authenticated;

grant execute on function public.list_bookable_sessions(uuid,uuid,text) to anon, authenticated;
grant execute on function public.get_bookable_session(uuid) to anon, authenticated;
grant execute on function public.get_my_host_bookings() to authenticated;
grant execute on function public.get_my_tutor_bookings() to authenticated;
grant execute on function public.get_my_bookings() to authenticated;
grant execute on function public.get_booking(uuid) to authenticated;
grant execute on function public.create_session(jsonb) to authenticated;
grant execute on function public.create_booking(uuid, int) to authenticated;

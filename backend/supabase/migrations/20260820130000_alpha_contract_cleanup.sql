-- 20260820130000_alpha_contract_cleanup.sql
-- Corrective reconciliation applied AFTER all 26 prior tracked migrations.
-- Resolves audit-29 P0/P1 defects found by independent review:
--   P0  - drop the obsolete create_booking(uuid, integer) overload to kill
--         PGRST203 ambiguity; keep the canonical create_booking(uuid,int,text).
--   P1  - reconcile resolve_booking_pricing + bookable-session read models off
--         the dead fixed_v1 model to flat_per_participant_v1 / hourly_v1.
--   P0  - create_offering: fix PostgREST param-name contract (p_kind ->
--         p_offering_type) and the ambiguous `slug = slug` PL/pgSQL reference.
--   SEC - close PUBLIC default-EXECUTE holes on workshop RPCs, strip the auth
--         UUID from the public offering read model, and fix the co-host
--         workshop-booking read regression.
--   UI  - merge the head host-authorization booking read model with the
--         canonical workshop read model that the head version overwrote.
-- Additive / CROR / DROP only. No columns dropped, no data touched.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Drop obsolete create_booking(uuid, integer) (Phase-1 PGRST203 fix)
-- ─────────────────────────────────────────────────────────────────────────
-- Lineage 0005 -> 0007 -> 0008 -> 20260815090001 -> 20260819120000 (one OID)
-- coexists with the canonical 3-arg form. PostgREST with 2 args matches both
-- (3-arg's remaining params have defaults) -> PGRST203.
do $$
declare
  f_oid oid := pg_catalog.to_regprocedure('public.create_booking(uuid, integer)');
  dep_count int;
begin
  if f_oid is null then
    raise notice 'create_booking(uuid, integer) already absent; nothing to drop.';
    return;
  end if;

  select count(*) into dep_count
  from pg_catalog.pg_depend d
  where d.refclassid = 'pg_catalog.pg_proc'::pg_catalog.regclass
    and d.refobjid = f_oid;

  if dep_count > 0 then
    raise exception 'REFUSING_TO_DROP: % database object(s) still depend on public.create_booking(uuid, integer)', dep_count;
  end if;
end $$;

drop function if exists public.create_booking(uuid, integer);

-- Assert the overload set is exactly the canonical 3-arg form.
do $$
declare
  overload_count int;
begin
  select count(*) into overload_count
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_booking'
    and p.prokind = 'f';

  if overload_count <> 1 then
    raise exception 'UNEXPECTED_OVERLOADS: expected exactly 1 create_booking, found %', overload_count;
  end if;

  if pg_catalog.to_regprocedure('public.create_booking(uuid, integer, text)') is null then
    raise exception 'MISSING_CANONICAL: public.create_booking(uuid, integer, text) not found';
  end if;
end $$;

revoke all on function public.create_booking(uuid, int, text) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, int, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. resolve_booking_pricing: only flat_per_participant_v1 + hourly_v1
-- ─────────────────────────────────────────────────────────────────────────
-- Signature/return shape preserved (shared-engine contract). Column reads
-- changed from the dead unit_price_vnd/fixed_v1 to price_per_participant_vnd /
-- flat_per_participant_v1, matching the canonical 3-arg create_booking logic.
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
  ppv bigint;
begin
  select * into s from public.sessions where id = p_session_id;
  if s.id is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
  select * into o from public.offerings where id = s.offering_id;
  if o.id is null then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;

  if o.pricing_model = 'flat_per_participant_v1' then
    ppv := o.price_per_participant_vnd;
    if ppv is null or ppv <= 0 then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023';
    end if;
    amount_vnd := ppv * p_participant_count;
    if amount_vnd <= 0 then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023';
    end if;
    pricing_model := 'flat_per_participant_v1';
    pricing_hourly_rate_vnd := null;
    pricing_duration_minutes := null;
    pricing_unit_price_vnd := ppv;
    pricing_participant_count := p_participant_count;
    pricing_currency := 'VND';
  else
    select tp.hourly_rate_vnd into rate
    from public.tutor_profiles tp where tp.user_id = s.host_id for share;
    if rate is null then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023';
    end if;
    duration := floor(extract(epoch from (s.ends_at - s.starts_at)) / 60)::int;
    if duration < 1 then
      raise exception 'INVALID_TRANSITION' using errcode='22023';
    end if;
    amount_vnd := round((rate::numeric * duration::numeric) / 60)::bigint;
    if amount_vnd <= 0 then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode='22023';
    end if;
    pricing_model := 'hourly_v1';
    pricing_hourly_rate_vnd := rate;
    pricing_duration_minutes := duration;
    pricing_unit_price_vnd := null;
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

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Bookable-session read models: drop fixed_v1, expose flat/model prices
-- ─────────────────────────────────────────────────────────────────────────
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
    'unitPriceVnd', case when o.kind = 'tutor' then null else o.price_per_participant_vnd end,
    'pricePerParticipantVnd', case when o.kind = 'tutor' then null else o.price_per_participant_vnd end,
    'currency', coalesce(tp.currency, o.currency),
    'pricingModel', case when o.kind = 'tutor' then 'hourly_v1' else 'flat_per_participant_v1' end
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

create or replace function public.get_bookable_session(p_session_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object(
  'offering', jsonb_build_object('id', o.id, 'kind', o.kind, 'title', o.title),
  'host', jsonb_build_object('id', s.host_id, 'displayName', coalesce(tp.display_name, p_host.name)),
  'tutorProfileId', tp.id,
  'hourlyRateVnd', tp.hourly_rate_vnd,
  'unitPriceVnd', case when o.kind = 'tutor' then null else o.price_per_participant_vnd end,
  'pricePerParticipantVnd', case when o.kind = 'tutor' then null else o.price_per_participant_vnd end,
  'currency', coalesce(tp.currency, o.currency),
  'pricingModel', case when o.kind = 'tutor' then 'hourly_v1' else 'flat_per_participant_v1' end
) || public.session_json(s.id)
from public.sessions s
join public.offerings o on o.id = s.offering_id and o.publication_status = 'published'
left join public.tutor_profiles tp on tp.user_id = s.host_id and o.kind = 'tutor' and tp.publication_status = 'published'
left join public.profiles p_host on p_host.id = s.host_id and o.kind != 'tutor'
where s.id = p_session_id and s.status = 'scheduled'
$$;
revoke all on function public.get_bookable_session(uuid) from public, anon, authenticated;
grant execute on function public.get_bookable_session(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Booking read model: head (host-authorization) + canonical workshop
--    read model merge. Additive over the head version: restores
--    pricePerParticipantVnd, paymentInFlight, learner displayName,
--    cancellation, instant paymentReady, offering/host keys, canTutorCancel.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.booking_read_json(bid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
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
    'pricePerParticipantVnd', b.pricing_price_per_participant_vnd,
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
  'learner', jsonb_build_object('displayName', learner.name),
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
    and (
      (o.booking_mode = 'approval' and exists(
        select 1 from public.booking_approvals a
        where a.booking_id = b.id
          and a.revoked_at is null
          and (a.expires_at is null or a.expires_at > now())
      ))
      or (o.booking_mode = 'instant')
    )
    and coalesce(p.status, 'pending') not in ('succeeded', 'refunded'),
  'paymentRetryAllowed', coalesce(p.status, 'pending') in ('pending', 'failed'),
  'paymentInFlight', p.status = 'pending' and exists(
    select 1 from public.payment_attempts pa
    where pa.payment_id = p.id and pa.status in ('created','redirected','pending','ambiguous')
  ),
  'canHostAccept', public.can_manage_offering(auth.uid(), o.id, 'host')
    and b.status = 'requested' and s.status = 'scheduled',
  'canHostReject', public.can_manage_offering(auth.uid(), o.id, 'host')
    and b.status = 'requested' and s.status = 'scheduled',
  'canTutorCancel', public.can_manage_offering(auth.uid(), o.id, 'host')
    and b.status = 'confirmed' and s.status = 'scheduled',
  'canLearnerCancel', b.learner_id = auth.uid()
    and b.status in ('requested', 'confirmed'),
  'canLearnerRequestReschedule', b.learner_id = auth.uid()
    and b.status in ('requested', 'confirmed') and s.status = 'scheduled',
  'cancellation', case when b.status = 'cancelled' then jsonb_build_object(
    'status', 'cancelled',
    'cancelledAt', (select max(h.at) from public.booking_history h where h.booking_id = b.id and h.to_status = 'cancelled'),
    'actor', b.cancelled_by,
    'reason', b.cancelled_reason
  ) else null end,
  'refund', case when p.id is null then null else jsonb_build_object(
    'status', case
      when exists(select 1 from public.refunds r where r.payment_id = p.id and r.status in ('failed','ambiguous')) then 'needs_attention'
      when exists(select 1 from public.refunds r where r.payment_id = p.id and r.status in ('obligation','pending')) then 'processing'
      when exists(select 1 from public.refunds r where r.payment_id = p.id and r.status = 'succeeded') then 'refunded'
      else 'none' end,
    'amountVnd', (select coalesce(sum(r.amount_vnd), 0) from public.refunds r where r.payment_id = p.id),
    'refundedAmountVnd', p.refunded_amount_vnd,
    'obligationCount', (select count(*) from public.refunds r where r.payment_id = p.id)
  ) end
)
from public.bookings b
join public.sessions s on s.id = b.session_id
join public.offerings o on o.id = s.offering_id
left join public.tutor_profiles tp on tp.user_id = s.host_id and o.kind = 'tutor'
left join public.profiles p_host on p_host.id = s.host_id and o.kind != 'tutor'
join public.profiles learner on learner.id = b.learner_id
left join public.payments p on p.booking_id = b.id
where b.id = bid
$$;
revoke all on function public.booking_read_json(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. create_offering: fix param contract + slug ambiguity + ACL
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.create_offering(
  p_offering_type text,
  p_title text,
  p_pricing_model text,
  p_price_per_participant_vnd bigint default null,
  p_hourly_rate_vnd bigint default null,
  p_booking_mode text default 'approval',
  p_description text default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  offering_id uuid;
  generated_slug text;
begin
  if p_pricing_model not in ('hourly_v1', 'flat_per_participant_v1') then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  if p_pricing_model = 'hourly_v1' and p_hourly_rate_vnd is null then
    raise exception 'MISSING_HOURLY_RATE' using errcode='22023';
  end if;
  if p_pricing_model = 'flat_per_participant_v1' and p_price_per_participant_vnd is null then
    raise exception 'MISSING_PRICE_PER_PARTICIPANT' using errcode='22023';
  end if;
  if p_booking_mode not in ('approval', 'instant') then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;
  if p_offering_type not in ('tutor', 'workshop', 'class', 'event') then
    raise exception 'INVALID_TRANSITION' using errcode='22023';
  end if;

  generated_slug := lower(regexp_replace(btrim(p_title), '[^a-z0-9]+', '-', 'g'));
  generated_slug := regexp_replace(generated_slug, '^-+|-+$', '', 'g');
  if char_length(generated_slug) > 120 then
    generated_slug := left(generated_slug, 120);
  end if;
  if generated_slug = '' then generated_slug := 'offering-' || replace(gen_random_uuid()::text, '-', ''); end if;

  if exists (select 1 from public.offerings where kind = p_offering_type and slug = generated_slug) then
    generated_slug := generated_slug || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  end if;

  insert into public.offerings(
    kind, slug, title, description, creator_id,
    pricing_model, price_per_participant_vnd, hourly_rate_vnd,
    booking_mode, publication_status
  ) values (
    p_offering_type, generated_slug, p_title, p_description, uid,
    p_pricing_model, p_price_per_participant_vnd, p_hourly_rate_vnd,
    p_booking_mode, 'draft'
  ) returning id into offering_id;

  return jsonb_build_object('id', offering_id, 'slug', generated_slug, 'publicationStatus', 'draft', 'version', 1);
end $$;
revoke all on function public.create_offering(text, text, text, bigint, bigint, text, text) from public, anon, authenticated;
grant execute on function public.create_offering(text, text, text, bigint, bigint, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Security: close PUBLIC default-EXECUTE holes and fix co-host reads
-- ─────────────────────────────────────────────────────────────────────────
-- CRITICAL: expire_stale_workshop_bookings is the TTL mass-cancel worker; it
-- must be service_role-only, NOT PUBLIC.
revoke all on function public.expire_stale_workshop_bookings(text) from public, anon, authenticated;
grant execute on function public.expire_stale_workshop_bookings(text) to service_role;

-- Browse RPCs stay reachable by anon/authenticated but not PUBLIC.
revoke all on function public.get_offering(uuid) from public, anon, authenticated;
grant execute on function public.get_offering(uuid) to anon, authenticated;

revoke all on function public.list_sessions_by_offering_id(uuid) from public, anon, authenticated;
grant execute on function public.list_sessions_by_offering_id(uuid) to anon, authenticated;

-- Author-only RPCs: authenticated only, not PUBLIC.
revoke all on function public.update_offering_status(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.update_offering_status(uuid, bigint, text) to authenticated;

-- get_offering: strip the auth-user UUID (creatorId) from the public read model
-- per the rule 'public tutor data must not expose auth IDs'. The published-only
-- filter is preserved. Public callers identify the creator via a slug path
-- instead of a raw auth id.
create or replace function public.get_offering(p_offering_id uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  return (
    select jsonb_build_object(
      'id', o.id,
      'kind', o.kind,
      'slug', o.slug,
      'title', o.title,
      'description', o.description,
      'unitPriceVnd', o.unit_price_vnd,
      'pricingModel', o.pricing_model,
      'pricePerParticipantVnd', o.price_per_participant_vnd,
      'hourlyRateVnd', o.hourly_rate_vnd,
      'bookingMode', o.booking_mode,
      'publicationStatus', o.publication_status,
      'currency', o.currency,
      'version', o.version
    )
    from public.offerings o
    where o.id = p_offering_id
      and o.publication_status = 'published'
  );
end $$;
revoke all on function public.get_offering(uuid) from public, anon, authenticated;
grant execute on function public.get_offering(uuid) to anon, authenticated;

-- list_sessions_by_offering_id: only list sessions of PUBLISHED offerings
-- (previously leaked schedules for draft/unpublished offerings).
create or replace function public.list_sessions_by_offering_id(p_offering_id uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'startsAt', s.starts_at,
        'endsAt', s.ends_at,
        'minParticipants', s.min_participants,
        'maxParticipants', s.max_participants,
        'spotsLeft', greatest(0, s.max_participants - coalesce(public.session_hard_reserved(s.id), 0)),
        'status', s.status
      ) order by s.starts_at
    )
    from public.sessions s
    join public.offerings o on o.id = s.offering_id
    where s.offering_id = p_offering_id
      and s.status = 'scheduled'
      and o.publication_status = 'published'
  ), '[]'::jsonb);
end $$;
revoke all on function public.list_sessions_by_offering_id(uuid) from public, anon, authenticated;
grant execute on function public.list_sessions_by_offering_id(uuid) to anon, authenticated;

-- get_my_workshop_bookings: co-hosts added via offering_hosts who are not the
-- session's host_id column value must still be able to read their workshop
-- bookings (matches the host-authorization model applied to every other booking
-- read in 20260820120000).
create or replace function public.get_my_workshop_bookings()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid;
  rows jsonb;
begin
  uid := auth.uid();
  if uid is null then raise insufficient_privilege; end if;

  select coalesce(jsonb_agg(public.booking_read_json(b.id) order by b.created_at desc), '[]'::jsonb)
  into rows
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where s.offering_id is not null
    and (s.host_id = uid or public.can_manage_offering(uid, s.offering_id, 'host'));

  return rows;
end $$;
revoke all on function public.get_my_workshop_bookings() from public, anon, authenticated;
grant execute on function public.get_my_workshop_bookings() to authenticated;

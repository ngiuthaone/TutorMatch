-- 20260908000001_public_capacity_hardening.sql
-- Drop hardReservedCapacity and spotsLeft from the public read models for
-- bookable sessions. These reveal real-time capacity utilization, which
-- is competitive intelligence for other hosts. The discover UI does not
-- surface this data today; it can be re-added later behind auth if a
-- product use case is established.
--
-- Approach: replace list_bookable_sessions and get_bookable_session to
-- use a new public_session_json helper that omits hardReservedCapacity and
-- spotsLeft. Authenticated read paths (bookings, my-sessions, etc.) keep
-- using the original session_json.
set search_path = '';

-- Public variant of session_json that omits capacity fields. Internal
-- callers (create_booking, confirm_booking, cancel_booking) continue to
-- use session_json which retains the full data.
create or replace function public.public_session_json(sid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object(
  'id', s.id, 'offeringId', s.offering_id, 'status', s.status,
  'startsAt', s.starts_at, 'endsAt', s.ends_at,
  'minParticipants', s.min_participants, 'maxParticipants', s.max_participants,
  'version', s.version)
from public.sessions s where s.id = sid
$$;
revoke all on function public.public_session_json(uuid) from public, anon, authenticated;

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
  ) || public.public_session_json(s.id) order by s.starts_at, s.id
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
  'unitPriceVnd', o.unit_price_vnd,
  'currency', coalesce(tp.currency, o.currency),
  'pricingModel', case when o.kind = 'tutor' then 'hourly_v1' else 'fixed_v1' end
) || public.public_session_json(s.id)
from public.sessions s
join public.offerings o on o.id = s.offering_id and o.publication_status = 'published'
left join public.tutor_profiles tp on tp.user_id = s.host_id and o.kind = 'tutor' and tp.publication_status = 'published'
left join public.profiles p_host on p_host.id = s.host_id and o.kind != 'tutor'
where s.id = p_session_id and s.status = 'scheduled'
$$;

revoke all on function public.get_bookable_session(uuid) from public, anon, authenticated;
grant execute on function public.get_bookable_session(uuid) to anon, authenticated;

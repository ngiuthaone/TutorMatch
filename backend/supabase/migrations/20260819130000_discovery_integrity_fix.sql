-- Discovery integrity fix: exclude Tutor Sessions without valid pricing authority
-- from bookable discovery. Additive only — no data deletion, no table changes.
-- Pricing resolver defense-in-depth preserved.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Fix list_bookable_sessions — exclude orphan Tutor Sessions
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
  and (o.kind != 'tutor' or (tp.user_id is not null and tp.hourly_rate_vnd is not null))
$$;

revoke all on function public.list_bookable_sessions(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.list_bookable_sessions(uuid,uuid,text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Fix get_bookable_session — same invariant
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
  and (o.kind != 'tutor' or (tp.user_id is not null and tp.hourly_rate_vnd is not null))
$$;

revoke all on function public.get_bookable_session(uuid) from public, anon, authenticated;
grant execute on function public.get_bookable_session(uuid) to anon, authenticated;

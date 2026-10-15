-- 20260915000060_fix_workshop_hourly_pricing.sql
-- Fix resolve_booking_pricing to handle workshop/class/event with hourly_v1 pricing model
-- The original function only handled tutor (hourly_v1) and flat_per_participant_v1 (workshop/class/event)
-- but workshops/classes/events can also have hourly_v1 pricing model.
set search_path = '';

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sessions%rowtype;
  o public.offerings%rowtype;
  rate bigint;
  duration integer;
  ppv bigint;
begin
  select * into s from public.sessions where id = p_session_id;
  if s.id is null then raise exception 'INVALID_TRANSITION' using errcode = '22023'; end if;
  select * into o from public.offerings where id = s.offering_id;
  if o.id is null then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;

  -- Flat per-participant pricing (workshop/class/event with fixed price per participant)
  if o.pricing_model = 'flat_per_participant_v1' then
    ppv := o.price_per_participant_vnd;
    if ppv is null or ppv <= 0 then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode = '22023';
    end if;
    amount_vnd := ppv * p_participant_count;
    if amount_vnd <= 0 then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode = '22023';
    end if;
    pricing_model := 'flat_per_participant_v1';
    pricing_hourly_rate_vnd := null;
    pricing_duration_minutes := null;
    pricing_unit_price_vnd := ppv;
    pricing_participant_count := p_participant_count;
    pricing_currency := 'VND';

  -- Hourly pricing for tutor OR workshop/class/event with hourly_v1 model
  elsif o.pricing_model = 'hourly_v1' then
    if o.kind = 'tutor' then
      -- Tutor hourly rate from tutor_profiles
      select tp.hourly_rate_vnd into rate
      from public.tutor_profiles tp
      where tp.user_id = (select creator_id from public.offerings where id = o.id)
      for share;
      if rate is null then
        raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode = '22023';
      end if;
    else
      -- Workshop/class/event with hourly_v1: use offering.hourly_rate_vnd
      rate := o.hourly_rate_vnd;
      if rate is null then
        raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode = '22023';
      end if;
    end if;

    duration := floor(extract(epoch from (s.ends_at - s.starts_at)) / 60)::int;
    if duration < 1 then
      raise exception 'INVALID_TRANSITION' using errcode = '22023';
    end if;
    amount_vnd := round((rate::numeric * duration::numeric) / 60)::bigint;
    if amount_vnd <= 0 then
      raise exception 'BOOKING_PRICE_NOT_SNAPSHOTTED' using errcode = '22023';
    end if;
    pricing_model := 'hourly_v1';
    pricing_hourly_rate_vnd := rate;
    pricing_duration_minutes := duration;
    pricing_unit_price_vnd := null;
    pricing_participant_count := p_participant_count;
    pricing_currency := 'VND';

  else
    raise exception 'INVALID_PRICING_MODEL' using errcode = '22023';
  end if;

  return query select
    amount_vnd,
    pricing_model,
    pricing_hourly_rate_vnd,
    pricing_duration_minutes,
    pricing_unit_price_vnd,
    pricing_participant_count,
    pricing_currency;
end $$;

revoke all on function public.resolve_booking_pricing(uuid,int) from public, anon, authenticated;
grant execute on function public.resolve_booking_pricing(uuid,int) to authenticated;
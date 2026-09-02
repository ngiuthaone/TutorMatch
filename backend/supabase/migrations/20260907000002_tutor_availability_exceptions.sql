-- Tutor availability exceptions: date-specific overrides, time-off,
-- holidays, blocked periods. Slicing these out of the base slots table
-- keeps the recurring-slot reads fast while allowing rich per-date control.
set search_path = '';

create table if not exists public.tutor_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references public.tutor_profiles(id) on delete cascade,
  exception_date date not null,
  exception_type text not null check (exception_type in ('unavailable','extra','modified')),
  -- For 'modified' only: override the recurring slot for this date
  modified_start_time time,
  modified_end_time time,
  modified_timezone text,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists tutor_availability_exceptions_tutor_date_idx
  on public.tutor_availability_exceptions(tutor_profile_id, exception_date);

alter table public.tutor_availability_exceptions enable row level security;
drop policy if exists tutor_availability_exceptions_owner_all on public.tutor_availability_exceptions;
create policy tutor_availability_exceptions_owner_all on public.tutor_availability_exceptions
  for all to authenticated using (
    exists (select 1 from public.tutor_profiles tp where tp.id = tutor_availability_exceptions.tutor_profile_id and tp.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.tutor_profiles tp where tp.id = tutor_availability_exceptions.tutor_profile_id and tp.user_id = auth.uid())
  );
-- Public read of extras/modified (so booking UI can show real availability)
drop policy if exists tutor_availability_exceptions_public_read_extras on public.tutor_availability_exceptions;
create policy tutor_availability_exceptions_public_read_extras on public.tutor_availability_exceptions
  for select to anon, authenticated using (exception_type in ('extra','modified'));

-- RPC: get a tutor's available time slots for the next N days, with exceptions applied
create or replace function public.get_tutor_available_slots(
  p_tutor_profile_id uuid,
  p_from_date date default current_date,
  p_days int default 14
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_session_duration int;
  v_booking_window_days int;
  v_same_day_booking boolean;
  v_tutor_timezone text;
  v_horizon date;
  v_results jsonb := '[]'::jsonb;
begin
  select
    coalesce(display_duration_min, 60),
    coalesce(booking_window_days, 30),
    coalesce(same_day_booking, false)
  into v_session_duration, v_booking_window_days, v_same_day_booking
  from public.tutor_profiles where id = p_tutor_profile_id;
  if v_session_duration is null then return '[]'::jsonb; end if;

  v_horizon := least(p_from_date + (p_days - 1), p_from_date + v_booking_window_days);

  -- For each date in [p_from_date, v_horizon]:
  --   1. If exception_type='unavailable' for that date, skip.
  --   2. If exception_type='modified' and modified_start_time/end_time set, use those (in tutor's timezone).
  --   3. Else fall back to the recurring weekly slot for the day-of-week.
  -- Then subtract any sessions already booked on that date.
  with date_range as (
    select generate_series(p_from_date, v_horizon, '1 day')::date as d
  ),
  effective_slots as (
    select
      dr.d as slot_date,
      s.start_time as slot_start,
      s.end_time as slot_end,
      s.timezone as slot_timezone
    from date_range dr
    join public.tutor_availability_slots s on s.day_of_week = extract(dow from dr.d)::int
      and s.tutor_profile_id = p_tutor_profile_id
    where not exists (
      select 1 from public.tutor_availability_exceptions ex
      where ex.tutor_profile_id = p_tutor_profile_id
        and ex.exception_date = dr.d
        and ex.exception_type = 'unavailable'
    )
  ),
  override_slots as (
    select
      ex.exception_date as slot_date,
      ex.modified_start_time as slot_start,
      ex.modified_end_time as slot_end,
      ex.modified_timezone as slot_timezone
    from public.tutor_availability_exceptions ex
    where ex.tutor_profile_id = p_tutor_profile_id
      and ex.exception_type = 'modified'
      and ex.exception_date between p_from_date and v_horizon
      and ex.modified_start_time is not null
      and ex.modified_end_time is not null
  ),
  all_slots as (
    select * from effective_slots
    union all
    select * from override_slots
  ),
  -- Subtract existing sessions that overlap the slot
  free_slots as (
    select a.slot_date, a.slot_start, a.slot_end, a.slot_timezone
    from all_slots a
    where not exists (
      select 1 from public.sessions sess
      join public.offerings o on o.id = sess.offering_id
      where o.kind = 'tutor'
        and o.creator_id = (select user_id from public.tutor_profiles where id = p_tutor_profile_id)
        and sess.status = 'scheduled'
        and (sess.starts_at at time zone coalesce(a.slot_timezone, 'UTC'))::date = a.slot_date
        and (
          (sess.starts_at at time zone coalesce(a.slot_timezone, 'UTC'))::time < a.slot_end
          and (sess.ends_at at time zone coalesce(a.slot_timezone, 'UTC'))::time > a.slot_start
        )
    )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', slot_date,
    'startTime', slot_start,
    'endTime', slot_end,
    'timezone', coalesce(slot_timezone, 'UTC')
  ) order by slot_date, slot_start), '[]'::jsonb)
  into v_results
  from free_slots;

  return v_results;
end $$;
revoke all on function public.get_tutor_available_slots(uuid, date, int) from public, anon, authenticated;
grant execute on function public.get_tutor_available_slots(uuid, date, int) to anon, authenticated;

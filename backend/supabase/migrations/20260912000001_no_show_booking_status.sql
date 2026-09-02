-- REUSE-5 (BookBarber pattern, reimplemented): add 'no_show' as a 7th booking status.
-- BookBarber's booking lifecycle has 7 states including 'no_show'; Tutoria's bookings table
-- originally had 5. Reimplemented under our own SQL — the BookBarber source is unlicensed
-- (per REPO_REUSE_MATRIX) so we kept the high-level idea (a terminal no-show state surfaced by
-- the host for a confirmed/completed session) without copying any SQL.
set search_path = '';

-- Expand the bookings.status check to include 'no_show'.
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (
  status in ('requested', 'confirmed', 'cancelled', 'rejected', 'completed', 'no_show')
);

-- Host-only RPC: mark a booking as no_show for a confirmed or completed session.
-- Uses optimistic locking (version CAS) so concurrent state changes don't race.
create or replace function public.mark_booking_no_show(
  p_booking_id uuid,
  p_expected_version bigint
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_booking record;
  v_host_user_id uuid;
  v_is_admin boolean := false;
begin
  if uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select b.id, b.status, b.version, s.host_id
    into v_booking
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    where b.id = p_booking_id;
  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_host_user_id := v_booking.host_id;

  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'admin'
  ) into v_is_admin;

  if v_host_user_id <> uid and not v_is_admin then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status not in ('confirmed', 'completed') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update public.bookings
    set status = 'no_show', updated_at = now(), version = version + 1
    where id = p_booking_id and version = p_expected_version;
  if not found then
    raise exception 'VERSION_CONFLICT' using errcode = 'P0001';
  end if;

  insert into public.booking_history(booking_id, from_status, to_status, actor)
    values (p_booking_id, v_booking.status, 'no_show', 'host');

  return jsonb_build_object('id', p_booking_id, 'status', 'no_show', 'version', p_expected_version + 1);
end $$;

revoke all on function public.mark_booking_no_show(uuid, bigint) from public, anon;
grant execute on function public.mark_booking_no_show(uuid, bigint) to authenticated;

-- Index tweak: 'no_show' should appear in bookings_session_status lookups alongside the
-- existing states (no schema change needed — the index is on raw status, not constrained).

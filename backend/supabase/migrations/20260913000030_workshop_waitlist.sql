set search_path = public;

-- Workshop waitlist table
create table if not exists workshop_waitlist (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  learner_id uuid not null references profiles(id) on delete cascade,
  participant_count integer not null default 1 check (participant_count > 0),
  joined_at timestamptz not null default now(),
  status text not null default 'waiting' check (status in ('waiting', 'promoted', 'expired', 'cancelled')),
  promoted_at timestamptz,
  promoted_booking_id uuid references bookings(id),
  unique (session_id, learner_id)
);

create index if not exists idx_waitlist_session_active 
  on workshop_waitlist(session_id, joined_at) 
  where status = 'waiting';

create index if not exists idx_waitlist_learner 
  on workshop_waitlist(learner_id, status);

-- RPC: join_waitlist(session_id, participant_count)
-- Returns the waitlist entry or error if already on waitlist / already has booking
create or replace function join_waitlist(p_session_id uuid, p_participant_count integer default 1)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.assert_authenticated();
  s sessions%rowtype;
  existing_booking boolean;
  existing_waitlist boolean;
  entry workshop_waitlist%rowtype;
  current_spots integer;
  max_spots integer;
begin
  -- Check session exists
  select * into s from sessions where id = p_session_id;
  if s.id is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  -- Check learner doesn't already have a booking for this session
  select exists (
    select 1 from bookings 
    where session_id = p_session_id 
    and learner_id = uid 
    and status in ('requested', 'confirmed')
  ) into existing_booking;
  
  if existing_booking then
    raise exception 'Already booked for this session';
  end if;

  -- Check not already on waitlist
  select exists (
    select 1 from workshop_waitlist
    where session_id = p_session_id and learner_id = uid and status = 'waiting'
  ) into existing_waitlist;
  
  if existing_waitlist then
    raise exception 'Already on waitlist for this session';
  end if;

  -- Calculate current availability
  select (
    s.max_participants - coalesce(
      (select sum(participant_count) from bookings 
       where session_id = p_session_id and status in ('requested', 'confirmed')),
      0
    )
  ) into current_spots;

  -- If spots available, there's no need for waitlist — but we still add them
  -- (they could take a spot immediately if they want)
  
  insert into workshop_waitlist (session_id, learner_id, participant_count)
  values (p_session_id, uid, p_participant_count)
  returning * into entry;

  return to_jsonb(entry);
end;
$$;

-- RPC: leave_waitlist(session_id)
create or replace function leave_waitlist(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.assert_authenticated();
begin
  update workshop_waitlist
  set status = 'cancelled'
  where session_id = p_session_id 
    and learner_id = uid 
    and status = 'waiting';
end;
$$;

-- RPC: get_my_waitlist_entries()
-- Returns all waitlist entries for the authenticated learner
create or replace function get_my_waitlist_entries()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.assert_authenticated();
begin
  return (
    select jsonb_agg(row_to_json(w))
    from (
      select w.*, s.title as session_title, s.starts_at as session_starts_at,
             o.title as offering_title
      from workshop_waitlist w
      join sessions s on s.id = w.session_id
      join offerings o on o.id = s.offering_id
      where w.learner_id = uid and w.status = 'waiting'
      order by w.joined_at asc
    ) w
  );
end;
$$;

-- RPC: promote_from_waitlist(p_session_id uuid)
-- Called after a cancellation to promote the first person on the waitlist
-- This is called automatically by cancel_booking/cancel_workshop_booking
create or replace function promote_from_waitlist(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  next_entry workshop_waitlist%rowtype;
  s sessions%rowtype;
  new_booking bookings%rowtype;
  new_version bigint;
  current_spots integer;
  max_spots integer;
begin
  select * into s from sessions where id = p_session_id;
  
  -- Check if there are spots available
  select (
    s.max_participants - coalesce(
      (select sum(participant_count) from bookings 
       where session_id = p_session_id and status in ('requested', 'confirmed')),
      0
    )
  ) into current_spots;
  
  if current_spots <= 0 then
    return null; -- No spots available
  end if;

  -- Get the first person on the waitlist
  select * into next_entry
  from workshop_waitlist
  where session_id = p_session_id and status = 'waiting'
  order by joined_at asc
  limit 1
  for update skip locked;

  if next_entry.id is null then
    return null; -- No one on waitlist
  end if;

  -- Create a booking for them (status = 'confirmed' since we're auto-promoting)
  insert into bookings (
    id, learner_id, session_id, status, version, 
    created_by, participant_count
  ) values (
    gen_random_uuid(), next_entry.learner_id, p_session_id, 'confirmed', 1,
    next_entry.learner_id, next_entry.participant_count
  )
  returning * into new_booking;

  -- Mark waitlist entry as promoted
  update workshop_waitlist
  set status = 'promoted', promoted_at = now(), promoted_booking_id = new_booking.id
  where id = next_entry.id;

  -- Insert outbox event
  perform public.insert_outbox_event(
    'BOOKING_CONFIRMED',
    'booking',
    new_booking.id,
    1,
    jsonb_build_object(
      'bookingId', new_booking.id,
      'sessionId', p_session_id,
      'learnerId', next_entry.learner_id,
      'participantCount', next_entry.participant_count,
      'promotedFromWaitlist', true
    )
  );

  return to_jsonb(new_booking);
end;
$$;

-- RPC: get_session_waitlist(p_session_id)
-- Returns the waitlist for a session (host only)
create or replace function get_session_waitlist(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.assert_authenticated();
  s sessions%rowtype;
begin
  select * into s from sessions where id = p_session_id;
  if s.id is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;
  
  if not public.can_manage_offering(uid, s.offering_id, 'host') then
    raise insufficient_privilege;
  end if;

  return (
    select jsonb_agg(row_to_json(w))
    from (
      select w.*, p.full_name as learner_name, p.email as learner_email
      from workshop_waitlist w
      join profiles p on p.id = w.learner_id
      where w.session_id = p_session_id and w.status = 'waiting'
      order by w.joined_at asc
    ) w
  );
end;
$$;

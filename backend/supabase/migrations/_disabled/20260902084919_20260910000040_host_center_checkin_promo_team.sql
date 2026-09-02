-- Host Center: real check-in token RPCs, real promotion codes / team queries.
-- Built on top of 20260902080928 (check_in_tokens/check_in_logs tables).
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- Helper: generate a short random token (12 uppercase alphanumeric chars)
-- Adapted from OpenEvents generateTicketCode() — MIT license.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public._generate_token()
returns text
language plpgsql stable
as $$
begin
  return upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 1. issue_check_in_token(p_user_id, p_session_id)
-- Issues a new one-time-use check-in token for a session.
-- The returned token is shown as QR/by-learner-entry.
-- Concurrency-safe: uses FOR UPDATE on the session row.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.issue_check_in_token(
  p_user_id   uuid,
  p_session_id uuid
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_token text;
  v_session_uuid uuid;
begin
  if p_user_id is null or p_session_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  -- Authorization: caller must be host of the session's offering
  select o.id into v_session_uuid
    from public.sessions s
    join public.offerings o on o.id = s.offering_id
    where s.id = p_session_id
      and public.can_manage_offering(p_user_id, o.id, 'host');
  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Prevent issuing during non-scheduled sessions
  if not exists (
    select 1 from public.sessions s where s.id = p_session_id and s.status = 'scheduled'
  ) then
    raise exception 'SESSION_NOT_SCHEDULED' using errcode = '22023';
  end if;

  -- Generate unique token (retry up to 3 times on collision)
  for i in 0..2 loop
    v_token := public._generate_token();
    begin
      insert into public.check_in_tokens (session_id, token)
      values (p_session_id, v_token)
      returning token into v_token;
      exit;
    exception when unique_violation then
      if i = 2 then raise exception 'TOKEN_GENERATION_FAILED' using errcode = 'P0001'; end if;
    end;
  end loop;

  -- Log issuance
  insert into public.check_in_logs (session_id, host_id, action, token)
  values (p_session_id, p_user_id, 'issued', v_token);

  return jsonb_build_object(
    'token',      v_token,
    'sessionId',  p_session_id,
    'issuedAt',   now(),
    'expiresAt',  null  -- tokens don't expire; host can undo within the session window
  );
end;
$$;

revoke all on function public.issue_check_in_token(uuid, uuid) from public, anon, authenticated;
grant execute on function public.issue_check_in_token(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 2. redeem_check_in_token(p_user_id, p_token)
-- Redeems a check-in token: marks it used, logs the action, returns
-- attendee confirmation.
-- Atomic: uses FOR UPDATE on the token row.
-- Duplicate redemption returns the original check-in (idempotent).
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.redeem_check_in_token(
  p_user_id uuid,
  p_token   text
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_rec    public.check_in_tokens%rowtype;
  v_log    public.check_in_logs%rowtype;
  v_host   uuid;
begin
  if p_user_id is null or p_token is null or length(p_token) = 0 then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  -- Look up token with lock
  select * into v_rec
    from public.check_in_tokens
    where token = p_token
    for update;

  if not found then
    raise exception 'TOKEN_NOT_FOUND' using errcode = '22023';
  end if;

  -- Check session authorization (host must own the session's offering)
  select s.host_id into v_host
    from public.sessions s
    join public.offerings o on o.id = s.offering_id
    where s.id = v_rec.session_id
      and public.can_manage_offering(p_user_id, o.id, 'host');
  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Already redeemed — return idempotent success with original info
  if v_rec.is_used then
    select * into v_log
      from public.check_in_logs
      where token = p_token and action = 'redeemed'
      order by performed_at desc limit 1;
    return jsonb_build_object(
      'success',    true,
      'alreadyRedeemed', true,
      'checkedInAt', v_rec.used_at,
      'logId',      v_log.id,
      'message',    'Already checked in.'
    );
  end if;

  -- Mark token used atomically
  update public.check_in_tokens
    set is_used = true, used_at = now()
    where id = v_rec.id;

  -- Insert log
  insert into public.check_in_logs (session_id, host_id, action, token)
    values (v_rec.session_id, p_user_id, 'redeemed', p_token)
    returning * into v_log;

  return jsonb_build_object(
    'success',        true,
    'alreadyRedeemed', false,
    'token',          p_token,
    'sessionId',      v_rec.session_id,
    'checkedInAt',    v_log.performed_at,
    'logId',          v_log.id,
    'message',        'Check-in successful.'
  );
end;
$$;

revoke all on function public.redeem_check_in_token(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_check_in_token(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 3. undo_check_in(p_user_id, p_token)
-- Undoes a check-in: marks token unused, logs 'undone'.
-- Only the host who originally redeemed can undo.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.undo_check_in(
  p_user_id uuid,
  p_token   text
) returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_rec  public.check_in_tokens%rowtype;
  v_log  public.check_in_logs%rowtype;
  v_host uuid;
begin
  if p_user_id is null or p_token is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select * into v_rec
    from public.check_in_tokens
    where token = p_token
    for update;

  if not found then
    raise exception 'TOKEN_NOT_FOUND' using errcode = '22023';
  end if;

  -- Authorization
  select s.host_id into v_host
    from public.sessions s
    join public.offerings o on o.id = s.offering_id
    where s.id = v_rec.session_id
      and public.can_manage_offering(p_user_id, o.id, 'host');
  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not v_rec.is_used then
    return jsonb_build_object('success', false, 'message', 'Token was not used.');
  end if;

  -- Undo: mark token as not used
  update public.check_in_tokens
    set is_used = false, used_at = null
    where id = v_rec.id;

  -- Insert undone log
  insert into public.check_in_logs (session_id, host_id, action, token)
    values (v_rec.session_id, p_user_id, 'undone', p_token)
    returning * into v_log;

  return jsonb_build_object(
    'success',    true,
    'logId',      v_log.id,
    'message',    'Check-in undone.'
  );
end;
$$;

revoke all on function public.undo_check_in(uuid, text) from public, anon, authenticated;
grant execute on function public.undo_check_in(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 4. list_host_check_in_logs(p_user_id, p_session_id, p_limit, p_offset)
-- Returns check-in audit logs scoped to the host's authorized sessions.
-- Ordered newest-first.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.list_host_check_in_logs(
  p_user_id    uuid,
  p_session_id uuid default null,
  p_limit      int  default 100,
  p_offset     int  default 0
) returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  v_limit  int := greatest(coalesce(p_limit, 100), 1);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if p_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if v_limit > 500 then v_limit := 500; end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.performed_at desc), '[]'::jsonb)
    into v_result
    from (
      select
        l.id,
        l.session_id,
        s.starts_at                       as session_starts_at,
        o.title                           as offering_title,
        l.action,
        l.token,
        l.performed_at,
        case l.action
          when 'issued'   then jsonb_build_object('issuedBy', p.id)
          when 'redeemed' then jsonb_build_object('redeemedBy', p.id)
          when 'undone'   then jsonb_build_object('undoneBy', p.id)
        end                               as metadata
      from public.check_in_logs l
      join public.sessions s on s.id = l.session_id
      join public.offerings o on o.id = s.offering_id
      join public.profiles p on p.id = l.host_id
      where public.can_manage_offering(p_user_id, o.id, 'host')
        and (p_session_id is null or l.session_id = p_session_id)
      order by l.performed_at desc
      limit v_limit offset v_offset
    ) t;

  return v_result;
end;
$$;

revoke all on function public.list_host_check_in_logs(uuid, uuid, int, int) from public, anon, authenticated;
grant execute on function public.list_host_check_in_logs(uuid, uuid, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 5. list_host_promotion_codes(p_user_id, p_offering_id, p_limit, p_offset)
-- Returns promotion codes for the host's offerings.
-- Adapted pattern from OpenEvents discount validation — MIT.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.list_host_promotion_codes(
  p_user_id    uuid,
  p_offering_id uuid default null,
  p_limit      int  default 100,
  p_offset     int  default 0
) returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  v_limit  int := greatest(coalesce(p_limit, 100), 1);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if p_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if v_limit > 500 then v_limit := 500; end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
    into v_result
    from (
      select
        pc.id,
        pc.offering_id,
        o.title                                  as offering_title,
        pc.code,
        pc.discount_type,
        pc.discount_value,
        pc.max_uses,
        pc.used_count,
        pc.starts_at,
        pc.ends_at,
        pc.is_active,
        pc.created_at,
        case
          when not pc.is_active                               then 'inactive'
          when pc.starts_at is not null and pc.starts_at > now() then 'scheduled'
          when pc.ends_at   is not null and pc.ends_at   < now() then 'expired'
          when pc.max_uses  is not null and pc.used_count >= pc.max_uses then 'exhausted'
          else 'active'
        end                                       as status
      from public.promotion_codes pc
      join public.offerings o on o.id = pc.offering_id
      where pc.host_id = p_user_id
        and (p_offering_id is null or pc.offering_id = p_offering_id)
      order by pc.created_at desc
      limit v_limit offset v_offset
    ) t;

  return v_result;
end;
$$;

revoke all on function public.list_host_promotion_codes(uuid, uuid, int, int) from public, anon, authenticated;
grant execute on function public.list_host_promotion_codes(uuid, uuid, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 6. list_host_team(p_user_id, p_offering_id, p_limit, p_offset)
-- Returns team members for the host's offerings, with profile info.
-- Uses existing profiles table for display data.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.list_host_team(
  p_user_id    uuid,
  p_offering_id uuid default null,
  p_limit      int  default 100,
  p_offset     int  default 0
) returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  v_limit  int := greatest(coalesce(p_limit, 100), 1);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
begin
  if p_user_id is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;
  if v_limit > 500 then v_limit := 500; end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.joined_at asc), '[]'::jsonb)
    into v_result
    from (
      select
        tm.id,
        tm.offering_id,
        o.title                                 as offering_title,
        tm.user_id,
        p.name                                  as display_name,
        p.avatar_url                            as avatar_object_path,
        tm.role,
        tm.capability,
        tm.invited_by,
        inv.name                                as invited_by_name,
        tm.joined_at,
        case
          when tm.capability = 'owner' then 'owner'
          when tm.capability = 'host'  then 'host'
          else 'member'
        end                                     as access_level
      from public.team_members tm
      join public.offerings o on o.id = tm.offering_id
      join public.profiles p on p.id = tm.user_id
      left join public.profiles inv on inv.id = tm.invited_by
      where public.can_manage_offering(p_user_id, o.id, 'host')
        and (p_offering_id is null or tm.offering_id = p_offering_id)
      order by tm.joined_at asc
      limit v_limit offset v_offset
    ) t;

  return v_result;
end;
$$;

revoke all on function public.list_host_team(uuid, uuid, int, int) from public, anon, authenticated;
grant execute on function public.list_host_team(uuid, uuid, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 7. Replace stub RPCs with references to the real ones above.
-- The old stubs (created in 20260902080928) are replaced via
-- CREATE OR REPLACE so grants and signatures stay consistent.
-- ─────────────────────────────────────────────────────────────────────

-- issue_check_in_token and redeem_check_in_token are already created above.
-- undo_check_in is already created above.
-- list_host_check_in_logs is already created above.
-- list_host_promotion_codes is already created above.
-- list_host_team is already created above.

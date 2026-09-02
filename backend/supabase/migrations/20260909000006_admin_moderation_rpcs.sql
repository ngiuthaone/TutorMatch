-- 20260909000006_admin_moderation_rpcs.sql
-- Add the admin-side moderation RPCs for conversation_reports that
-- complement the existing tutor-media moderation surface. The
-- conversation_reports table is already in place (created in
-- 20260909000000_messaging_alpha_v2.sql) and the report_message RPC
-- already exists for end-user report submission. This migration
-- adds the admin-side read + decide + suspend RPCs so the moderation
-- queue is resolvable.
--
-- All RPCs are SECURITY DEFINER. They assert admin role from
-- public.profiles.role = 'admin' before allowing access. This is
-- a server-side authorization gate, not a UI hide.
set search_path = '';

-- Admin can list reports with status filter.
create or replace function public.list_conversation_reports(
  p_status text default 'pending',
  p_limit int default 100
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  lim int;
  rows jsonb;
  status_filter text;
begin
  if uid is null then raise insufficient_privilege; end if;
  if (select role from public.profiles where id = uid) <> 'admin' then
    raise insufficient_privilege;
  end if;
  lim := greatest(1, least(coalesce(p_limit, 100), 500));
  status_filter := case when p_status = 'all' then null else p_status end;
  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
    into rows
  from (
    select r.id, r.reporter_id, r.conversation_id, r.message_id, r.reason, r.details,
           r.status, r.resolved_by, r.resolved_at, r.created_at,
           jsonb_build_object('id', reporter.id, 'name', reporter.name) as reporter,
           jsonb_build_object('id', msg.sender_id, 'body', left(msg.body, 280), 'created_at', msg.created_at) as message_preview
      from public.conversation_reports r
      left join public.profiles reporter on reporter.id = r.reporter_id
      left join public.messages msg on msg.id = r.message_id
     where (status_filter is null or r.status = status_filter)
     order by r.created_at desc
     limit lim
  ) t;
  return rows;
end $$;
revoke all on function public.list_conversation_reports(text, int) from public, anon, authenticated;
grant execute on function public.list_conversation_reports(text, int) to authenticated;

-- Admin can resolve a single report.
create or replace function public.resolve_conversation_report(
  p_report_id uuid,
  p_status text,
  p_details text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r public.conversation_reports%rowtype;
begin
  if uid is null then raise insufficient_privilege; end if;
  if (select role from public.profiles where id = uid) <> 'admin' then
    raise insufficient_privilege;
  end if;
  if p_status not in ('resolved','dismissed') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  select * into r from public.conversation_reports where id = p_report_id for update;
  if r.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  update public.conversation_reports
     set status = p_status,
         resolved_by = uid,
         resolved_at = now(),
         details = coalesce(p_details, details)
   where id = p_report_id;
  return jsonb_build_object('id', p_report_id, 'status', p_status, 'resolvedBy', uid, 'resolvedAt', now());
end $$;
revoke all on function public.resolve_conversation_report(uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_conversation_report(uuid, text, text) to authenticated;

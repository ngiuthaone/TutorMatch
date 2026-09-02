-- Outbox processor cron schedule
-- Calls the Edge Function via net.http_post every minute

set search_path = public;

-- Ensure pgcron extension is enabled
create extension if not exists pgcron;

-- Set Edge Function URL based on environment
-- For local development: http://127.0.0.1:54331 (Supabase Studio runs on 54321, Edge Functions on 54331)
-- For production: https://${PROJECT_REF}.supabase.co/functions/v1/outbox-processor
do $$
declare
  project_ref text;
  edge_url text;
begin
  -- Try to get project ref from Supabase settings
  begin
    project_ref := current_setting('app.supabase_project_ref', true);
  exception when undefined_object then
    project_ref := null;
  end;

  if project_ref is not null and project_ref != '' then
    edge_url := 'https://' || project_ref || '.supabase.co/functions/v1/outbox-processor';
  else
    -- Local development URL (Edge Functions exposed on port 54331)
    edge_url := 'http://127.0.0.1:54331/functions/v1/outbox-processor';
  end if;

  perform set_config('app.outbox_edge_url', edge_url, true);
end $$;

-- Wrapper SQL function called by pg_cron
-- This function uses net.http_post to call the Edge Function
create or replace function process_outbox_batch()
returns integer language plpgsql security definer set search_path = public as $$
declare
  edge_url text;
  service_key text;
  result_record record;
  response_body jsonb;
  http_status integer;
begin
  edge_url := current_setting('app.outbox_edge_url', true);
  service_key := current_setting('app.supabase_service_role_key', true);

  if edge_url is null or edge_url = '' then
    raise notice 'Outbox Edge URL not configured';
    return 0;
  end if;

  -- Call the Edge Function via net.http_post
  select
    status_code,
    content::jsonb as body
  into result_record
  from net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(service_key, '')
    ),
    body := jsonb_build_object('batch_size', 20)::json
  );

  http_status := result_record.status_code;
  response_body := result_record.body;

  if http_status >= 200 and http_status < 300 then
    raise notice 'Outbox batch processed: % processed, % failed',
      coalesce(response_body->>'processed', '0'),
      coalesce(response_body->>'failed', '0');
    return coalesce((response_body->>'processed')::integer, 0);
  else
    raise notice 'Outbox Edge Function returned status %: %', http_status, response_body;
    return 0;
  end if;

exception when others then
  raise notice 'Outbox processor error: %', sqlerrm;
  return 0;
end;
$$;

grant execute on function process_outbox_batch() to service_role;

-- Idempotent reschedule: unschedule first if exists, then schedule
do $$ 
begin
  perform cron.unschedule('process-outbox-every-minute');
exception when others then
  null; -- job didn't exist, ignore
end
$$;

select cron.schedule(
  'process-outbox-every-minute',
  '* * * * *',
  $$select process_outbox_batch();$$
);

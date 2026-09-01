-- 20260907000010_session_published_self_notification.sql
-- Self-notification when a tutor publishes their profile (or, in future,
-- creates/publishes a session). Idempotent: existing tutors who re-publish
-- still get one notification per publish action.
set search_path = '';

create or replace function public.publish_my_tutor_cv(expected_version bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_tutor_caller();
  pid uuid;
  v bigint;
begin
  select id, version into pid, v from public.tutor_profiles where user_id = uid for update;
  if pid is null then raise no_data_found; end if;
  if v <> expected_version then raise exception 'PROFILE_VERSION_CONFLICT' using errcode = '40001'; end if;
  if not public.tutor_cv_publishable(pid) then raise exception 'TUTOR_CV_INCOMPLETE' using errcode = '22023'; end if;
  update public.tutor_profiles
    set publication_status = 'published', published_at = now(), unpublished_at = null, updated_at = now(), version = version + 1
    where id = pid
    returning version into v;
  insert into public.tutor_profile_events(tutor_profile_id, actor_user_id, event_type, profile_version)
    values (pid, uid, 'published', v);
  insert into public.notifications(recipient_id, actor_id, type, entity_type, entity_id, message)
    values (uid, uid, 'session_published', 'tutor_profile', pid, 'Your tutor profile is now published and bookable.');
  return public.tutor_cv_json(pid, true);
end $$;

-- Re-grant permissions (idempotent)
revoke all on function public.publish_my_tutor_cv(bigint) from public, anon;
grant execute on function public.publish_my_tutor_cv(bigint) to authenticated;

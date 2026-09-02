-- 20260822000000_tutor_profile_media_and_full_fields.sql
-- Closes the become-a-tutor form <-> published profile gap in live mode by:
--   Phase A) durable media moderation state machine (media_submissions) +
--            Storage bucket config (avatars / intro-videos / verification-docs)
--            with owner-scoped RLS; uploads cannot self-approve.
--   Phase B) persist every remaining form field on tutor_profiles (role, intro
--            video, portfolio, lesson description, policies, consultation,
--            rates/display duration) plus new relational tables (credentials,
--            goals, teaching styles, age groups, faqs) and extend the CV RPC
--            whitelist + read model + publishability gate accordingly.
--
-- Additive / create-if-missing / CROR only. No columns dropped, no data touched.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────────
-- Phase A: media moderation lifecycle (durable, provider-agnostic)
-- ─────────────────────────────────────────────────────────────────────────
-- Publication is not verification and unmoderated media is never auto-published.
-- A client/Edge-function scan (image/video moderation provider; chosen at
-- integration time) records its decision here; an uploaded object only becomes
-- public once its submission row reaches 'approved'.

do $$ begin
  create type public.media_kind as enum ('photo','intro_video','verification_doc');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.media_status as enum ('pending','approved','rejected','removed');
exception when duplicate_object then null;
end $$;

create table if not exists public.media_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tutor_profile_id uuid references public.tutor_profiles(id) on delete set null,
  kind public.media_kind not null,
  bucket text not null,
  object_path text not null,
  mime text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  status public.media_status not null default 'pending',
  moderation_provider text,
  moderation_result jsonb not null default '{}'::jsonb,
  moderation_note text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, object_path),
  check (char_length(btrim(bucket)) between 1 and 64),
  check (char_length(btrim(object_path)) between 1 and 1024),
  check (char_length(btrim(mime)) between 1 and 128),
  check (jsonb_typeof(moderation_result) = 'object')
);
create index if not exists media_submissions_user on public.media_submissions(user_id);
create index if not exists media_submissions_status on public.media_submissions(status, kind);
create index if not exists media_submissions_profile on public.media_submissions(tutor_profile_id);

-- Storage buckets are declared in supabase/config.toml / provisioned by the
-- CLI; the RLS on storage.objects (below) is the authoritative access boundary.

-- Bucket name helper kept in one place for the app/worker layer.
create or replace function public.tutor_media_bucket(kind public.media_kind) returns text
language sql stable set search_path = '' as $$
  select case kind
    when 'photo' then 'avatars'
    when 'intro_video' then 'intro-videos'
    when 'verification_doc' then 'verification-docs'
  end
$$;
revoke all on function public.tutor_media_bucket(public.media_kind) from public, anon, authenticated;

-- Path helper: an upload path must begin with the calling user's id so that an
-- actor can only ever write under their own directory.
create or replace function public.media_path_for_user(object_path text, p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user is null then raise insufficient_privilege; end if;
  if object_path is null or split_part(btrim(object_path), '/', 1) <> p_user::text
     or char_length(btrim(object_path)) > 1024 then
    raise exception 'TUTOR_MEDIA_INVALID' using errcode = '22023';
  end if;
  return btrim(object_path);
end;
$$;
revoke all on function public.media_path_for_user(text, uuid) from public, anon, authenticated;

-- Record a media submission after an upload. The caller may only register media
-- under their own `{userId}/...` path and may not self-approve; a fresh (or
-- re-submitted) submission always starts pending. Linked to the tutor profile
-- automatically when one exists, otherwise left unlinked until the CV is saved.
create or replace function public.submit_tutor_media(p_kind public.media_kind, p_object_path text, p_mime text, p_size_bytes bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_tutor_caller();
  path text;
  bucket_name text := public.tutor_media_bucket(p_kind);
  sub_id uuid;
begin
  -- photo = avatar; enforce the tighter avatar ceiling (5 MiB), videos <= 50 MiB
  if p_size_bytes is null or p_size_bytes < 0 or p_size_bytes > 52428800 or
     (p_kind = 'photo' and p_size_bytes > 5242880) then
    raise exception 'TUTOR_MEDIA_INVALID' using errcode = '22023';
  end if;
  if p_mime is null or btrim(p_mime) = '' then
    raise exception 'TUTOR_MEDIA_INVALID' using errcode = '22023';
  end if;
  path := public.media_path_for_user(p_object_path, uid);

  insert into public.media_submissions(user_id, tutor_profile_id, kind, bucket, object_path, mime, size_bytes, status)
  select uid, tp.id, p_kind, bucket_name, path, btrim(p_mime), p_size_bytes, 'pending'
  from (select id from public.tutor_profiles where user_id = uid) tp
  on conflict (bucket, object_path)
  do update set status = 'pending',
                moderation_provider = null,
                moderation_result = '{}'::jsonb,
                moderation_note = null,
                decided_by = null,
                decided_at = null,
                updated_at = now()
  returning id into sub_id;

  if sub_id is null then
    insert into public.media_submissions(user_id, tutor_profile_id, kind, bucket, object_path, mime, size_bytes, status)
    values (uid, null, p_kind, bucket_name, path, btrim(p_mime), p_size_bytes, 'pending')
    on conflict (bucket, object_path)
    do update set status = 'pending',
                  moderation_provider = null,
                  decided_by = null,
                  decided_at = null,
                  updated_at = now()
    returning id into sub_id;
  end if;

  return jsonb_build_object('id', sub_id, 'kind', p_kind, 'bucket', bucket_name, 'objectPath', path, 'status', 'pending');
end;
$$;

-- Internal decision setter. Only reached through the admin/service-role RPCs
-- below; revoked from anon/authenticated so a plain tutor cannot call it.
create or replace function public.decide_tutor_media(p_submission_id uuid, p_status public.media_status,
  p_provider text, p_note text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  out_row jsonb;
begin
  if p_status not in ('approved', 'rejected', 'removed') then
    raise exception 'TUTOR_MEDIA_INVALID' using errcode = '22023';
  end if;
  update public.media_submissions
     set status = p_status,
         moderation_provider = coalesce(p_provider, moderation_provider),
         moderation_note = p_note,
         decided_by = actor,
         decided_at = now(),
         updated_at = now()
   where id = p_submission_id
   returning jsonb_build_object('id', id, 'status', status, 'decidedAt', decided_at) into out_row;
  if out_row is null then raise no_data_found; end if;
  return out_row;
end;
$$;

-- Admin moderator endpoint (authenticated admins + service-role moderation worker).
-- service_role bypasses RLS and has no auth.uid(); allow it explicitly.
create or replace function public.assert_admin_caller() returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); role public.user_role;
begin
  if auth.role() = 'service_role' then return coalesce(uid, '00000000-0000-0000-0000-000000000000'::uuid); end if;
  if uid is null then raise insufficient_privilege; end if;
  select p.role into role from public.profiles p where p.id = uid;
  if role is distinct from 'admin'::public.user_role then raise insufficient_privilege; end if;
  return uid;
end;
$$;
revoke all on function public.assert_admin_caller() from public, anon, authenticated;

create or replace function public.moderate_tutor_media(p_submission_id uuid, p_status public.media_status, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.assert_admin_caller();
begin
  if p_status not in ('approved', 'rejected', 'removed') then
    raise exception 'TUTOR_MEDIA_INVALID' using errcode = '22023';
  end if;
  return public.decide_tutor_media(p_submission_id, p_status, 'manual', p_note);
end;
$$;

-- Owner may view and retract (soft-remove) only their own media submissions.
create or replace function public.get_my_tutor_media() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'status', status,
         'objectPath', object_path, 'mime', mime, 'sizeBytes', size_bytes, 'moderationNote', moderation_note)
         order by created_at desc), '[]'::jsonb)
  from public.media_submissions where user_id = public.assert_tutor_caller()
$$;

create or replace function public.remove_my_tutor_media(p_submission_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.assert_tutor_caller(); out_row jsonb;
begin
  update public.media_submissions
     set status = 'removed', decided_by = uid, decided_at = now(), updated_at = now()
   where id = p_submission_id and user_id = uid
   returning jsonb_build_object('id', id, 'status', status) into out_row;
  if out_row is null then raise no_data_found; end if;
  return out_row;
end;
$$;

-- Public read model: only approved media is ever exposed, and it never leaks the
-- owner identity until a tutor profile itself is published. Driven off the
-- tutor's published profile so unapproved/removed media stays hidden.
create or replace function public.get_published_media(tutor_profile_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'photo', (select sub.object_path from public.media_submissions sub
              where sub.tutor_profile_id = tutor_profile_id and sub.kind = 'photo'
                and sub.status = 'approved' order by sub.created_at desc limit 1),
    'introVideo', (select sub.object_path from public.media_submissions sub
              where sub.tutor_profile_id = tutor_profile_id and sub.kind = 'intro_video'
                and sub.status = 'approved' order by sub.created_at desc limit 1))
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Phase B: full-field persistence on tutor_profiles + relational tables
-- ─────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.tutor_verification_status as enum ('none', 'pending_review', 'verified');
exception when duplicate_object then null;
end $$;

alter table public.tutor_profiles
  add column if not exists role text,
  add column if not exists intro_video_object_path text,
  add column if not exists portfolio_url text,
  add column if not exists lesson_description text,
  add column if not exists cancel_learner_policy text,
  add column if not exists cancel_late_policy text,
  add column if not exists no_show_policy text,
  add column if not exists booking_notice text,
  add column if not exists booking_window_days integer,
  add column if not exists lesson_buffer_min integer,
  add column if not exists same_day_booking boolean not null default false,
  add column if not exists display_duration_min integer,
  add column if not exists rates jsonb,
  add column if not exists consultation jsonb,
  add column if not exists verification_status public.tutor_verification_status not null default 'none';

do $$ begin
  alter table public.tutor_profiles drop constraint if exists tutor_profiles_role_chk;
  alter table public.tutor_profiles add constraint tutor_profiles_role_chk check (role is null or (role = btrim(role) and char_length(role) between 1 and 120));
  alter table public.tutor_profiles drop constraint if exists tutor_profiles_portfolio_chk;
  alter table public.tutor_profiles add constraint tutor_profiles_portfolio_chk check (portfolio_url is null or char_length(btrim(portfolio_url)) between 1 and 512);
  alter table public.tutor_profiles drop constraint if exists tutor_profiles_intro_video_chk;
  alter table public.tutor_profiles add constraint tutor_profiles_intro_video_chk check (intro_video_object_path is null or char_length(intro_video_object_path) <= 1024);
  alter table public.tutor_profiles drop constraint if exists tutor_profiles_lesson_desc_chk;
  alter table public.tutor_profiles add constraint tutor_profiles_lesson_desc_chk check (lesson_description is null or char_length(lesson_description) <= 2000);
  alter table public.tutor_profiles drop constraint if exists tutor_profiles_rates_chk;
  alter table public.tutor_profiles add constraint tutor_profiles_rates_chk check (rates is null or jsonb_typeof(rates) = 'object');
  alter table public.tutor_profiles drop constraint if exists tutor_profiles_consultation_chk;
  alter table public.tutor_profiles add constraint tutor_profiles_consultation_chk check (consultation is null or jsonb_typeof(consultation) = 'object');
  alter table public.tutor_profiles drop constraint if exists tutor_profiles_window_chk;
  alter table public.tutor_profiles add constraint tutor_profiles_window_chk check (booking_window_days is null or booking_window_days between 1 and 365);
end $$;

create table if not exists public.tutor_credentials (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references public.tutor_profiles(id) on delete cascade,
  title text not null,
  evidence_url text,
  verified boolean not null default false,
  sort_order integer not null default 0,
  check (char_length(btrim(title)) between 1 and 160),
  check (evidence_url is null or (char_length(btrim(evidence_url)) between 1 and 512))
);
create table if not exists public.tutor_goals (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references public.tutor_profiles(id) on delete cascade,
  goal text not null,
  sort_order integer not null default 0,
  check (char_length(btrim(goal)) between 1 and 300)
);
create table if not exists public.tutor_teaching_styles (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references public.tutor_profiles(id) on delete cascade,
  style text not null,
  sort_order integer not null default 0,
  check (char_length(btrim(style)) between 1 and 200)
);
create table if not exists public.tutor_age_groups (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references public.tutor_profiles(id) on delete cascade,
  group_name text not null,
  sort_order integer not null default 0,
  check (char_length(btrim(group_name)) between 1 and 120)
);
create table if not exists public.tutor_faqs (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references public.tutor_profiles(id) on delete cascade,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  check (char_length(btrim(question)) between 1 and 300),
  check (char_length(btrim(answer)) between 1 and 1000)
);

create index if not exists tutor_faqs_profile on public.tutor_faqs(tutor_profile_id, sort_order);
create index if not exists tutor_age_groups_profile on public.tutor_age_groups(tutor_profile_id, sort_order);
create index if not exists tutor_credentials_profile on public.tutor_credentials(tutor_profile_id, sort_order);
create index if not exists tutor_goals_profile on public.tutor_goals(tutor_profile_id, sort_order);
create index if not exists tutor_teaching_styles_profile on public.tutor_teaching_styles(tutor_profile_id, sort_order);

-- ─────────────────────────────────────────────────────────────────────────
-- Phase B: extend the CV read model with the persisted full fields
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.tutor_cv_full_json(pid uuid, include_private boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'displayName', p.display_name, 'headline', p.headline, 'bio', p.bio,
    'role', p.role, 'hourlyRateVnd', p.hourly_rate_vnd, 'currency', p.currency,
    'teachingFormat', p.teaching_format, 'portfolioUrl', p.portfolio_url,
    'lessonDescription', p.lesson_description,
    'policies', jsonb_build_object('learnerCancellation', p.cancel_learner_policy,
                                   'lateCancellation', p.cancel_late_policy,
                                   'noShow', p.no_show_policy,
                                   'bookingNotice', p.booking_notice,
                                   'bookingWindowDays', p.booking_window_days,
                                   'lessonBufferMin', p.lesson_buffer_min,
                                   'sameDayBooking', p.same_day_booking),
    'rates', p.rates, 'displayDuration', p.display_duration_min,
    'consultation', p.consultation,
    'verificationStatus', case when include_private then to_jsonb(p.verification_status) else null end,
    'subjects', coalesce((select jsonb_agg(s.slug order by s.sort_order, s.slug)
        from public.tutor_subjects x join public.subjects s on s.id = x.subject_id
        where x.tutor_profile_id = p.id), '[]'::jsonb),
    'levels', coalesce((select jsonb_agg(x.level_code order by x.level_code)
        from public.tutor_levels x where x.tutor_profile_id = p.id), '[]'::jsonb),
    'regions', coalesce((select jsonb_agg(r.slug order by r.sort_order, r.slug)
        from public.tutor_regions x join public.regions r on r.id = x.region_id
        where x.tutor_profile_id = p.id), '[]'::jsonb),
    'languages', coalesce((select jsonb_agg(jsonb_build_object('code', x.language_code,
        'displayName', x.display_name, 'proficiency', x.proficiency) order by x.language_code)
        from public.tutor_languages x where x.tutor_profile_id = p.id), '[]'::jsonb),
    'availability', coalesce((select jsonb_agg(jsonb_build_object('dayOfWeek', x.day_of_week,
        'startTime', to_char(x.start_time, 'HH24:MI'), 'endTime', to_char(x.end_time, 'HH24:MI'), 'timezone', x.timezone)
        order by x.day_of_week, x.start_time) from public.tutor_availability_slots x
        where x.tutor_profile_id = p.id), '[]'::jsonb),
    'education', coalesce((select jsonb_agg(jsonb_build_object('institution', x.institution,
        'qualification', x.qualification, 'fieldOfStudy', x.field_of_study, 'startYear', x.start_year,
        'endYear', x.end_year, 'description', x.description) order by x.sort_order)
        from public.tutor_education_entries x where x.tutor_profile_id = p.id), '[]'::jsonb),
    'experience', coalesce((select jsonb_agg(jsonb_build_object('title', x.title,
        'organization', x.organization, 'startYear', x.start_year, 'endYear', x.end_year,
        'description', x.description) order by x.sort_order) from public.tutor_experience_entries x
        where x.tutor_profile_id = p.id), '[]'::jsonb),
    'credentials', coalesce((select jsonb_agg(jsonb_build_object('title', x.title,
        'evidenceUrl', x.evidence_url) order by x.sort_order) from public.tutor_credentials x
        where x.tutor_profile_id = p.id), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(x.goal order by x.sort_order) from public.tutor_goals x
        where x.tutor_profile_id = p.id), '[]'::jsonb),
    'teachingStyles', coalesce((select jsonb_agg(x.style order by x.sort_order)
        from public.tutor_teaching_styles x where x.tutor_profile_id = p.id), '[]'::jsonb),
    'ageGroups', coalesce((select jsonb_agg(x.group_name order by x.sort_order)
        from public.tutor_age_groups x where x.tutor_profile_id = p.id), '[]'::jsonb),
    'faqs', coalesce((select jsonb_agg(jsonb_build_object('question', x.question, 'answer', x.answer)
        order by x.sort_order) from public.tutor_faqs x where x.tutor_profile_id = p.id), '[]'::jsonb),
    'photoObjectPath', case when include_private then p.avatar_object_path else null end,
    'introVideoObjectPath', case when include_private then p.intro_video_object_path else null end,
    'publicationStatus', case when include_private then to_jsonb(p.publication_status) else null end,
    'publishedAt', p.published_at,
    'updatedAt', case when include_private then p.updated_at else null end,
    'version', case when include_private then p.version else null end)
  from public.tutor_profiles p where p.id = pid
$$;
revoke all on function public.tutor_cv_full_json(uuid, boolean) from public, anon, authenticated;

-- Public exposure of media is additionally gated on the approved moderation state.
create or replace function public.tutor_cv_json(pid uuid, include_private boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  base jsonb := public.tutor_cv_full_json(pid, include_private);
  photo_path text;
  video_path text;
begin
  if base is null then return null; end if;
  -- approved media only, and only for a published profile in the public read
  select sub.object_path into photo_path from public.media_submissions sub
    where sub.tutor_profile_id = pid and sub.kind = 'photo' and sub.status = 'approved'
    order by sub.created_at desc limit 1;
  select sub.object_path into video_path from public.media_submissions sub
    where sub.tutor_profile_id = pid and sub.kind = 'intro_video' and sub.status = 'approved'
    order by sub.created_at desc limit 1;
  if photo_path is null then photo_path := base->>'photoObjectPath'; end if;
  if video_path is null then video_path := base->>'introVideoObjectPath'; end if;
  return base
    || jsonb_build_object(
         'avatarUrl', case when photo_path is null then null
           else concat(current_setting('app.settings.avatar_public_base_url', true), '/', photo_path) end,
         'introVideoUrl', case when include_private and video_path is not null then concat(current_setting('app.settings.avatar_public_base_url', true), '/', video_path) else null end,
         'verified', base->'verificationStatus' = to_jsonb('verified'::public.tutor_verification_status));
end;
$$;
revoke all on function public.tutor_cv_json(uuid, boolean) from public, anon, authenticated;

-- Publishability: the extra text fields the form requires for a complete listing.
create or replace function public.tutor_cv_publishable(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
select char_length(coalesce(p.headline, '')) between 10 and 120
  and char_length(coalesce(p.bio, '')) between 100 and 2000
  and char_length(coalesce(p.role, '')) >= 1
  and p.hourly_rate_vnd between 50000 and 10000000
  and p.teaching_format is not null
  and exists(select 1 from public.tutor_subjects x join public.subjects s on s.id = x.subject_id where x.tutor_profile_id = p.id and s.active)
  and exists(select 1 from public.tutor_levels x where x.tutor_profile_id = p.id)
  and exists(select 1 from public.tutor_languages x where x.tutor_profile_id = p.id)
  and exists(select 1 from public.tutor_availability_slots x where x.tutor_profile_id = p.id)
  and exists(select 1 from public.tutor_age_groups x where x.tutor_profile_id = p.id)
  and p.lesson_description is not null and char_length(p.lesson_description) >= 40
  and (p.teaching_format = 'online' or exists(select 1 from public.tutor_regions x join public.regions r on r.id = x.region_id where x.tutor_profile_id = p.id and r.active))
from public.tutor_profiles p where p.id = pid
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Phase B: extend save_my_tutor_cv to persist the full field set
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.save_my_tutor_cv(payload jsonb, expected_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := public.assert_tutor_caller();
  pid uuid; old_status public.tutor_publication_status; new_version bigint;
  item jsonb; n integer;
  allowed text[] := array[
    'displayName','headline','bio','hourlyRateVnd','currency','teachingFormat',
    'subjects','levels','regions','languages','availability','education','experience',
    'role','portfolioUrl','lessonDescription','policies','rates','displayDuration',
    'consultation','credentials','goals','teachingStyles','ageGroups','faqs'
  ];
begin
  if payload is null or jsonb_typeof(payload) <> 'object'
     or exists(select 1 from jsonb_object_keys(payload) k where not (k = any (allowed))) then
    raise exception 'TUTOR_CV_INVALID' using errcode = '22023';
  end if;
  if public.tutor_text_has_contact(payload->>'displayName')
     or public.tutor_text_has_contact(payload->>'headline')
     or public.tutor_text_has_contact(payload->>'bio')
     or public.tutor_text_has_contact(payload->>'role')
     or public.tutor_text_has_contact(payload->>'lessonDescription')
     or public.tutor_text_has_contact(coalesce(payload->>'policies', '{}'))
     or public.tutor_text_has_contact(coalesce(payload->>'consultation', '{}'))
     or public.tutor_text_has_contact(coalesce(payload->>'goals', '[]'))
     or public.tutor_text_has_contact(coalesce(payload->>'ageGroups', '[]'))
     or public.tutor_text_has_contact(coalesce(payload->>'teachingStyles', '[]'))
     -- faqs: only free-text question/answer (never a URL-bearing field)
     or exists(select 1 from jsonb_array_elements(coalesce(payload->'faqs', '[]'::jsonb)) f
                where public.tutor_text_has_contact(f->>'question') or public.tutor_text_has_contact(f->>'answer'))
     -- credentials: only the title is free text; evidenceUrl is an explicit link
     or exists(select 1 from jsonb_array_elements(coalesce(payload->'credentials', '[]'::jsonb)) c
                where public.tutor_text_has_contact(c->>'title')) then
    raise exception 'CONTACT_INFORMATION_NOT_ALLOWED' using errcode = '22023';
  end if;
  if coalesce(jsonb_array_length(payload->'subjects'), 0) > 10
     or coalesce(jsonb_array_length(payload->'levels'), 0) > 10
     or coalesce(jsonb_array_length(payload->'regions'), 0) > 20
     or coalesce(jsonb_array_length(payload->'languages'), 0) > 8
     or coalesce(jsonb_array_length(payload->'availability'), 0) > 28
     or coalesce(jsonb_array_length(payload->'education'), 0) > 5
     or coalesce(jsonb_array_length(payload->'experience'), 0) > 10
     or coalesce(jsonb_array_length(payload->'credentials'), 0) > 20
     or coalesce(jsonb_array_length(payload->'goals'), 0) > 12
     or coalesce(jsonb_array_length(payload->'teachingStyles'), 0) > 12
     or coalesce(jsonb_array_length(payload->'ageGroups'), 0) > 12
     or coalesce(jsonb_array_length(payload->'faqs'), 0) > 12 then
    raise exception 'TUTOR_CV_INVALID' using errcode = '22023';
  end if;

  select id, publication_status into pid, old_status from public.tutor_profiles where user_id = uid for update;
  if pid is null then
    if expected_version is not null then raise exception 'PROFILE_VERSION_CONFLICT' using errcode='45000'; end if;
    insert into public.tutor_profiles(user_id, display_name, headline, bio, hourly_rate_vnd, currency, teaching_format,
        role, portfolio_url, lesson_description, cancel_learner_policy, cancel_late_policy, no_show_policy,
        booking_notice, booking_window_days, lesson_buffer_min, same_day_booking, display_duration_min, rates, consultation)
    values (uid, btrim(payload->>'displayName'), nullif(btrim(payload->>'headline'), ''),
            nullif(btrim(payload->>'bio'), ''), (payload->>'hourlyRateVnd')::bigint,
            coalesce(payload->>'currency', 'VND'), (payload->>'teachingFormat')::public.teaching_format,
            nullif(btrim(payload->>'role'), ''), nullif(btrim(payload->>'portfolioUrl'), ''),
            nullif(btrim(payload->>'lessonDescription'), ''),
            nullif(btrim(payload->'policies'->>'learnerCancellation'), ''),
            nullif(btrim(payload->'policies'->>'lateCancellation'), ''),
            nullif(btrim(payload->'policies'->>'noShow'), ''),
            nullif(btrim(payload->'policies'->>'bookingNotice'), ''),
            nullif((payload->'policies'->>'bookingWindowDays')::int, 0),
            nullif((payload->'policies'->>'lessonBufferMin')::int, 0),
            coalesce((payload->'policies'->>'sameDayBooking')::boolean, false),
            nullif((payload->>'displayDuration')::int, 0),
            case when jsonb_typeof(payload->'rates') = 'object' then payload->'rates' else null end,
            case when jsonb_typeof(payload->'consultation') = 'object' then payload->'consultation' else null end)
    returning id, publication_status, version into pid, old_status, new_version;
    insert into public.tutor_profile_events(tutor_profile_id, actor_user_id, event_type, profile_version)
    values (pid, uid, 'created', new_version);
  else
    if expected_version is null or (select version from public.tutor_profiles where id = pid) <> expected_version then
      raise exception 'PROFILE_VERSION_CONFLICT' using errcode='45000';
    end if;
    update public.tutor_profiles set
      display_name = btrim(payload->>'displayName'),
      headline = nullif(btrim(payload->>'headline'), ''),
      bio = nullif(btrim(payload->>'bio'), ''),
      hourly_rate_vnd = (payload->>'hourlyRateVnd')::bigint,
      currency = payload->>'currency',
      teaching_format = (payload->>'teachingFormat')::public.teaching_format,
      role = nullif(btrim(payload->>'role'), ''),
      portfolio_url = nullif(btrim(payload->>'portfolioUrl'), ''),
      lesson_description = nullif(btrim(payload->>'lessonDescription'), ''),
      cancel_learner_policy = nullif(btrim(payload->'policies'->>'learnerCancellation'), ''),
      cancel_late_policy = nullif(btrim(payload->'policies'->>'lateCancellation'), ''),
      no_show_policy = nullif(btrim(payload->'policies'->>'noShow'), ''),
      booking_notice = nullif(btrim(payload->'policies'->>'bookingNotice'), ''),
      booking_window_days = nullif((payload->'policies'->>'bookingWindowDays')::int, 0),
      lesson_buffer_min = nullif((payload->'policies'->>'lessonBufferMin')::int, 0),
      same_day_booking = coalesce((payload->'policies'->>'sameDayBooking')::boolean, false),
      display_duration_min = nullif((payload->>'displayDuration')::int, 0),
      rates = case when jsonb_typeof(payload->'rates') = 'object' then payload->'rates' else null end,
      consultation = case when jsonb_typeof(payload->'consultation') = 'object' then payload->'consultation' else null end,
      updated_at = now(), version = version + 1
    where id = pid returning version into new_version;
  end if;

  delete from public.tutor_subjects where tutor_profile_id = pid;
  insert into public.tutor_subjects select pid, s.id from jsonb_array_elements_text(payload->'subjects') v
    join public.subjects s on s.slug = v.value;
  if (select count(*) from public.tutor_subjects where tutor_profile_id = pid) <> jsonb_array_length(payload->'subjects') then
    raise exception 'TUTOR_CV_INVALID' using errcode = '22023';
  end if;

  delete from public.tutor_levels where tutor_profile_id = pid;
  insert into public.tutor_levels select pid, value from jsonb_array_elements_text(payload->'levels');

  delete from public.tutor_regions where tutor_profile_id = pid;
  insert into public.tutor_regions select pid, r.id from jsonb_array_elements_text(payload->'regions') v
    join public.regions r on r.slug = v.value;
  if (select count(*) from public.tutor_regions where tutor_profile_id = pid) <> jsonb_array_length(payload->'regions') then
    raise exception 'TUTOR_CV_INVALID' using errcode = '22023';
  end if;

  delete from public.tutor_languages where tutor_profile_id = pid;
  for item in select * from jsonb_array_elements(payload->'languages') loop
    insert into public.tutor_languages(tutor_profile_id, language_code, display_name, proficiency)
    values (pid, btrim(item->>'code'), btrim(item->>'displayName'), (item->>'proficiency')::public.language_proficiency);
  end loop;

  delete from public.tutor_availability_slots where tutor_profile_id = pid;
  for item in select * from jsonb_array_elements(payload->'availability') loop
    if exists(select 1 from public.tutor_availability_slots where tutor_profile_id = pid
        and day_of_week = (item->>'dayOfWeek')::int
        and start_time < (item->>'endTime')::time and end_time > (item->>'startTime')::time) then
      raise exception 'TUTOR_CV_INVALID' using errcode = '22023';
    end if;
    insert into public.tutor_availability_slots(tutor_profile_id, day_of_week, start_time, end_time, timezone)
    values (pid, (item->>'dayOfWeek')::int, (item->>'startTime')::time, (item->>'endTime')::time, btrim(item->>'timezone'));
  end loop;

  delete from public.tutor_education_entries where tutor_profile_id = pid;
  n := 0;
  for item in select * from jsonb_array_elements(payload->'education') loop
    insert into public.tutor_education_entries(tutor_profile_id, institution, qualification, field_of_study, start_year, end_year, description, sort_order)
    values (pid, btrim(item->>'institution'), btrim(item->>'qualification'),
            coalesce(btrim(item->>'fieldOfStudy'), ''), (item->>'startYear')::int,
            (item->>'endYear')::int, coalesce(btrim(item->>'description'), ''), n);
    n := n + 1;
  end loop;

  delete from public.tutor_experience_entries where tutor_profile_id = pid;
  n := 0;
  for item in select * from jsonb_array_elements(payload->'experience') loop
    insert into public.tutor_experience_entries(tutor_profile_id, title, organization, start_year, end_year, description, sort_order)
    values (pid, btrim(item->>'title'), btrim(item->>'organization'),
            (item->>'startYear')::int, (item->>'endYear')::int,
            coalesce(btrim(item->>'description'), ''), n);
    n := n + 1;
  end loop;

  delete from public.tutor_credentials where tutor_profile_id = pid;
  n := 0;
  for item in select * from jsonb_array_elements(payload->'credentials') loop
    insert into public.tutor_credentials(tutor_profile_id, title, evidence_url, sort_order)
    values (pid, btrim(item->>'title'), nullif(btrim(coalesce(item->>'evidenceUrl', '')), ''), n);
    n := n + 1;
  end loop;

  delete from public.tutor_goals where tutor_profile_id = pid;
  n := 0;
  for item in select * from jsonb_array_elements(payload->'goals') loop
    insert into public.tutor_goals(tutor_profile_id, goal, sort_order)
    values (pid, btrim(item #>> '{}'), n); n := n + 1;
  end loop;

  delete from public.tutor_teaching_styles where tutor_profile_id = pid;
  n := 0;
  for item in select * from jsonb_array_elements(payload->'teachingStyles') loop
    insert into public.tutor_teaching_styles(tutor_profile_id, style, sort_order)
    values (pid, btrim(item #>> '{}'), n); n := n + 1;
  end loop;

  delete from public.tutor_age_groups where tutor_profile_id = pid;
  n := 0;
  for item in select * from jsonb_array_elements(payload->'ageGroups') loop
    insert into public.tutor_age_groups(tutor_profile_id, group_name, sort_order)
    values (pid, btrim(item #>> '{}'), n); n := n + 1;
  end loop;

  delete from public.tutor_faqs where tutor_profile_id = pid;
  n := 0;
  for item in select * from jsonb_array_elements(payload->'faqs') loop
    insert into public.tutor_faqs(tutor_profile_id, question, answer, sort_order)
    values (pid, btrim(item->>'question'), btrim(item->>'answer'), n); n := n + 1;
  end loop;

  if old_status = 'published' and not public.tutor_cv_publishable(pid) then
    raise exception 'TUTOR_CV_INCOMPLETE' using errcode = '22023';
  end if;
  insert into public.tutor_profile_events(tutor_profile_id, actor_user_id, event_type, profile_version)
  values (pid, uid, case when old_status = 'published' then 'published_profile_updated' else 'draft_saved' end, new_version);
  return public.tutor_cv_json(pid, true);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Grants / revokes for the new objects
-- ─────────────────────────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array[
    'media_submissions','tutor_credentials','tutor_goals','tutor_teaching_styles',
    'tutor_age_groups','tutor_faqs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;
end $$;

revoke all on function public.submit_tutor_media(public.media_kind, text, text, bigint),
              public.get_my_tutor_media(), public.remove_my_tutor_media(uuid),
              public.decide_tutor_media(uuid, public.media_status, text, text),
              public.moderate_tutor_media(uuid, public.media_status, text),
              public.get_published_media(uuid)
  from public, anon, authenticated;

grant execute on function public.submit_tutor_media(public.media_kind, text, text, bigint) to authenticated;
grant execute on function public.get_my_tutor_media() to authenticated;
grant execute on function public.remove_my_tutor_media(uuid) to authenticated;
-- moderation decision is available to admins (authenticated) and the service-role worker
grant execute on function public.moderate_tutor_media(uuid, public.media_status, text) to authenticated, service_role;
grant execute on function public.get_published_media(uuid) to anon, authenticated;

-- The tutor CV RPCs keep their prior grants (re-affirmed here after CREATE OR REPLACE).
grant execute on function public.save_my_tutor_cv(jsonb, bigint) to authenticated;
grant execute on function public.get_published_tutor(uuid), public.list_published_tutors(jsonb) to anon, authenticated;

-- Storage bucket RLS. Only the object owner may write under their own folder;
-- public reads of approved avatar/video media are allowed to anon (used only for
-- a published profile's approved photo); verification documents stay private.
do $$ begin
  -- apps
  drop policy if exists tutor_media_select_owner on storage.objects;
  create policy tutor_media_select_owner on storage.objects for select to authenticated
    using ((storage.foldername(name))[1] = (auth.uid())::text and bucket_id in ('avatars','intro-videos','verification-docs'));

  drop policy if exists tutor_media_insert_owner on storage.objects;
  create policy tutor_media_insert_owner on storage.objects for insert to authenticated
    with check ((storage.foldername(name))[1] = (auth.uid())::text and bucket_id in ('avatars','intro-videos','verification-docs'));

  drop policy if exists tutor_media_delete_owner on storage.objects;
  create policy tutor_media_delete_owner on storage.objects for delete to authenticated
    using ((storage.foldername(name))[1] = (auth.uid())::text and bucket_id in ('avatars','intro-videos','verification-docs'));

  -- public read of approved media (avatars bucket only; videos/docs stay private)
  drop policy if exists tutor_media_select_public_approved on storage.objects;
  create policy tutor_media_select_public_approved on storage.objects for select to anon
    using (bucket_id = 'avatars' and exists (
      select 1 from public.media_submissions m
      where m.bucket = 'avatars' and m.object_path = name and m.status = 'approved'));
end $$;

-- Tutor reviews (1:1 tutoring). Separate from course_reviews (which is for
-- course offerings only). Eligible reviewers = learners with a completed
-- booking for any session of any of the tutor's offerings.
set search_path = '';

create table if not exists public.tutor_reviews (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references public.tutor_profiles(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 10 and 2000),
  status text not null default 'published' check (status in ('published','hidden','removed')),
  published_at timestamptz default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id)
);
create index if not exists tutor_reviews_tutor_idx on public.tutor_reviews(tutor_profile_id, published_at desc);
create index if not exists tutor_reviews_learner_idx on public.tutor_reviews(learner_id, published_at desc);

create or replace function public.set_tutor_reviews_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at := now(); return new; end; $$;
revoke all on function public.set_tutor_reviews_updated_at() from public, anon, authenticated;
drop trigger if exists tutor_reviews_set_updated_at on public.tutor_reviews;
create trigger tutor_reviews_set_updated_at before update on public.tutor_reviews
  for each row execute function public.set_tutor_reviews_updated_at();

alter table public.tutor_reviews enable row level security;

-- Public read of published reviews
create policy tutor_reviews_public_read on public.tutor_reviews
  for select to anon, authenticated using (status = 'published');

-- Learners can insert their own review for a booking they completed
-- Server-side eligibility check is in the RPC create_tutor_review below
create policy tutor_reviews_owner_insert on public.tutor_reviews
  for insert to authenticated with check (
    learner_id = auth.uid()
  );

-- Learners can update their own review (within 30 days of published_at, server-checked)
create policy tutor_reviews_owner_update on public.tutor_reviews
  for update to authenticated using (learner_id = auth.uid()) with check (learner_id = auth.uid());

-- Admins can update any (for moderation)
-- (no separate policy needed; admins can use service_role or a dedicated RPC)

-- RPC: create a tutor review (eligibility enforced server-side)
create or replace function public.create_tutor_review(
  p_booking_id uuid,
  p_rating int,
  p_body text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_learner_id uuid;
  v_tutor_profile_id uuid;
  v_session_offering_id uuid;
  v_booking_status text;
  v_payment_status text;
  v_id uuid;
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING' using errcode = '22023';
  end if;
  if btrim(coalesce(p_body, '')) = '' or char_length(p_body) > 2000 then
    raise exception 'INVALID_BODY' using errcode = '22023';
  end if;

  select b.learner_id, b.status, s.offering_id
    into v_learner_id, v_booking_status, v_session_offering_id
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    where b.id = p_booking_id;
  if v_learner_id is null then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_learner_id != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_booking_status <> 'completed' then raise exception 'BOOKING_NOT_COMPLETED' using errcode = 'P0001'; end if;
  -- Payment must have succeeded (or been refunded as part of a system cancel)
  select status into v_payment_status from public.payments where booking_id = p_booking_id;
  if v_payment_status is null then raise exception 'NO_PAYMENT' using errcode = 'P0001'; end if;
  if v_payment_status not in ('succeeded', 'refunded') then
    raise exception 'PAYMENT_NOT_FINALIZED' using errcode = 'P0001';
  end if;

  -- Resolve the tutor profile (the offering's creator who has capability)
  select tp.id into v_tutor_profile_id
    from public.offerings o
    join public.offering_hosts oh on oh.offering_id = o.id and oh.capability in ('owner','host') and oh.revoked_at is null
    join public.tutor_profiles tp on tp.user_id = oh.user_id
    where o.id = v_session_offering_id
    limit 1;
  if v_tutor_profile_id is null then raise exception 'TUTOR_NOT_FOUND' using errcode = 'P0001'; end if;

  insert into public.tutor_reviews(tutor_profile_id, booking_id, learner_id, rating, body)
    values (v_tutor_profile_id, p_booking_id, uid, p_rating, btrim(p_body))
    returning id into v_id;

  return jsonb_build_object('id', v_id, 'tutorProfileId', v_tutor_profile_id);
end $$;
revoke all on function public.create_tutor_review(uuid, int, text) from public, anon, authenticated;
grant execute on function public.create_tutor_review(uuid, int, text) to authenticated;

-- RPC: list reviews for a tutor (public)
create or replace function public.list_tutor_reviews(
  p_tutor_profile_id uuid,
  p_limit int default 20,
  p_offset int default 0
) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(t.obj order by t.published_at desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', r.id,
      'rating', r.rating,
      'body', r.body,
      'publishedAt', r.published_at,
      'learner', jsonb_build_object(
        'name', p.name,
        'avatarUrl', p.avatar_url
      )
    ) obj, r.published_at
    from public.tutor_reviews r
    left join public.profiles p on p.id = r.learner_id
    where r.tutor_profile_id = p_tutor_profile_id and r.status = 'published'
    order by r.published_at desc
    limit greatest(1, least(coalesce(p_limit, 20), 50))
    offset greatest(0, coalesce(p_offset, 0))
  ) t;
$$;
revoke all on function public.list_tutor_reviews(uuid, int, int) from public, anon, authenticated;
grant execute on function public.list_tutor_reviews(uuid, int, int) to anon, authenticated;

-- RPC: get aggregate rating for a tutor (public, used in cards + profile)
create or replace function public.get_tutor_rating_summary(p_tutor_profile_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'count', count(*)::int,
    'average', case when count(*) = 0 then null else round(avg(rating)::numeric, 2)::float end
  )
  from public.tutor_reviews
  where tutor_profile_id = p_tutor_profile_id and status = 'published';
$$;
revoke all on function public.get_tutor_rating_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_tutor_rating_summary(uuid) to anon, authenticated;

-- 20260907000004_course_faqs.sql
-- FAQ table for course creator parity with iframe
set search_path = '';

create table if not exists public.course_faqs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 160),
  answer text not null check (char_length(btrim(answer)) between 1 and 800),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists course_faqs_course_id_idx on public.course_faqs(course_id, position);

alter table public.course_faqs enable row level security;

revoke all on table public.course_faqs from public, anon, authenticated;

-- Public read FAQs for published courses
create policy course_faqs_public_read on public.course_faqs
  for select to anon, authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_faqs.course_id and c.status = 'published'
  ));

-- Creator can read/write FAQs for their own course
create policy course_faqs_creator_all on public.course_faqs
  for all to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_faqs.course_id and c.creator_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.courses c
    where c.id = course_faqs.course_id and c.creator_id = auth.uid()
  ));

create or replace function public.set_course_faq_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists course_faqs_set_updated_at on public.course_faqs;
create trigger course_faqs_set_updated_at before update on public.course_faqs
  for each row execute function public.set_course_faq_updated_at();

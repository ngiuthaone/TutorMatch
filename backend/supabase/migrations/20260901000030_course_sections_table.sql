-- 20260901000030_course_sections_table.sql
-- Creates public.course_sections for organizing course content into ordered sections.
set search_path = '';

create table if not exists public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

create index if not exists course_sections_course_id_idx on public.course_sections(course_id, position);

alter table public.course_sections enable row level security;

revoke all on table public.course_sections from public, anon, authenticated;

-- Public read access
drop policy if exists course_sections_public_read on public.course_sections;
create policy course_sections_public_read on public.course_sections
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = course_sections.course_id
        and (c.status = 'published' or c.creator_id = auth.uid())
    )
  );

-- Only course creator can insert/update/delete via ownership check
drop policy if exists course_sections_creator_write on public.course_sections;
create policy course_sections_creator_write on public.course_sections
  for all to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = course_sections.course_id
        and c.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.courses c
      where c.id = course_sections.course_id
        and c.creator_id = auth.uid()
    )
  );

-- updated_at trigger function
create or replace function public.set_course_section_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

revoke all on function public.set_course_section_updated_at() from public, anon, authenticated;

drop trigger if exists course_sections_set_updated_at on public.course_sections;
create trigger course_sections_set_updated_at
  before update on public.course_sections
  for each row execute function public.set_course_section_updated_at();

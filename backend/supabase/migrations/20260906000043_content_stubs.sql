-- 20260906000043_content_stubs.sql
-- Persistent stub state for content surfaces not yet shipped.
-- Avoids localStorage for any user-facing published stub content so the in-app
-- message can be edited from admin without a deploy.
set search_path = '';

create table if not exists public.content_stubs (
  id uuid primary key default gen_random_uuid(),
  surface text not null check (surface in ('messages','courses','payouts')),
  title text not null,
  body text not null,
  cta_label text,
  cta_href text,
  status text not null default 'published' check (status in ('draft','published')),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_stubs_surface_idx
  on public.content_stubs(surface)
  where status = 'published';

create index if not exists content_stubs_surface_published_at_idx
  on public.content_stubs(surface, published_at desc)
  where status = 'published';

alter table public.content_stubs enable row level security;

create policy content_stubs_public_read
  on public.content_stubs
  for select
  to anon, authenticated
  using (status = 'published');

create policy content_stubs_admin_all
  on public.content_stubs
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

create or replace function public.set_content_stubs_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists content_stubs_set_updated_at on public.content_stubs;
create trigger content_stubs_set_updated_at
  before update on public.content_stubs
  for each row execute function public.set_content_stubs_updated_at();

insert into public.content_stubs (surface, title, body, cta_label, cta_href) values
  ('messages', 'Messaging coming Q2 2026', 'For now, contact your tutor or learner via Zalo, Messenger, or email. Your booking confirmation includes their contact details.', 'Find my bookings', '/bookings'),
  ('courses', 'Structured courses coming Q2 2026', 'Browse our 1:1 tutors and live workshops to start learning today.', 'Browse tutors', '/tutors'),
  ('payouts', 'Payouts are processed manually', 'Tutor payouts are sent manually every Friday. You will receive an email when your payout has been sent.', null, null)
on conflict do nothing;

-- 20260907000002_course_coupons.sql
-- Coupons/promotions for course creator parity
set search_path = '';

create table if not exists public.course_coupons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  code text not null check (char_length(btrim(code)) between 3 and 50),
  coupon_type text not null check (coupon_type in ('best_price', 'custom', 'free')),
  discount_amount_vnd bigint check (discount_amount_vnd is null or discount_amount_vnd >= 0),
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  current_redemptions integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, code)
);

create index if not exists course_coupons_course_id_idx on public.course_coupons(course_id);
create index if not exists course_coupons_code_idx on public.course_coupons(code) where is_active = true;

alter table public.course_coupons enable row level security;

revoke all on table public.course_coupons from public, anon, authenticated;

-- Public can read active coupons for published courses (to apply at checkout)
create policy course_coupons_public_read on public.course_coupons
  for select to anon, authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_coupons.course_id and c.status = 'published' and is_active = true
  ));

-- Creator manages coupons for their course
create policy course_coupons_creator_all on public.course_coupons
  for all to authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_coupons.course_id and c.creator_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.courses c
    where c.id = course_coupons.course_id and c.creator_id = auth.uid()
  ));

create or replace function public.set_course_coupon_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists course_coupons_set_updated_at on public.course_coupons;
create trigger course_coupons_set_updated_at before update on public.course_coupons
  for each row execute function public.set_course_coupon_updated_at();

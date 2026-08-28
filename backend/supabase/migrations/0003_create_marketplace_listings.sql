-- Durable public listings for courses and workshops. The payload keeps the creator UI flexible
-- while ownership, visibility, and public reads remain enforced by RLS.
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('course','event')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (title = btrim(title) and char_length(title) between 1 and 300),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'published' check (status in ('draft','published','unpublished')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 500000),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug)
);
create index if not exists marketplace_public_order on public.marketplace_listings(kind, published_at desc) where status = 'published';
alter table public.marketplace_listings enable row level security;
revoke all on public.marketplace_listings from public, anon, authenticated;
grant select on public.marketplace_listings to anon, authenticated;
grant insert, update on public.marketplace_listings to authenticated;
create policy "public marketplace listings are readable" on public.marketplace_listings for select using (status = 'published' or creator_id = auth.uid());
create policy "creators insert own marketplace listings" on public.marketplace_listings for insert with check (creator_id = auth.uid());
create policy "creators update own marketplace listings" on public.marketplace_listings for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());

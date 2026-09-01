-- 20260906000010_notifications_schema.sql
-- Notifications table for likes, comments, reposts, follows.
set search_path = '';

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  recipient_id    uuid not null references public.profiles(id) on delete cascade,
  actor_id        uuid references public.profiles(id) on delete set null,
  type            text not null check (type in ('like','comment','reply','repost','follow')),
  entity_type     text not null check (entity_type in ('post','article','comment')),
  entity_id       uuid not null,
  message         text not null,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index idx_notifications_recipient on public.notifications (recipient_id, created_at desc);
create index idx_notifications_unread on public.notifications (recipient_id, read) where read = false;

alter table public.notifications enable row level security;

create policy "notifications_owner_read"
  on public.notifications for select
  to authenticated
  using (recipient_id = auth.uid());

create policy "notifications_owner_update"
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

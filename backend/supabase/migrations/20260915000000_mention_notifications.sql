-- 20260915000000_mention_notifications.sql
-- Add 'mention' notification type and a SECURITY DEFINER helper that extracts
-- @username mentions from free-text bodies. Wire AFTER INSERT triggers on
-- comments, posts, and reference_thread_replies so that mentioning a user
-- produces a 'mention' notification for that user (skipping self-mentions).
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- Extend notifications.type CHECK to include 'mention'
-- ─────────────────────────────────────────────────────────────────────
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like','comment','reply','repost','follow','mention'));

-- ─────────────────────────────────────────────────────────────────────
-- extract_mentions(p_body text) RETURNS uuid[]
-- Parses @username tokens, looks them up in public.profiles.name, and
-- returns a deduplicated array of user UUIDs. SECURITY DEFINER so it can
-- read profile rows regardless of caller RLS; callable by trigger bodies.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.extract_mentions(p_body text)
returns uuid[]
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_ids uuid[] := '{}'::uuid[];
  v_username text;
  v_user_id uuid;
  c_mention cursor for
    select distinct m.username
    from (
      select (regexp_matches(p_body, '@([A-Za-z0-9_]{1,32})', 'g'))[1] as username
    ) m
    where m.username is not null;
begin
  if p_body is null or btrim(p_body) = '' then
    return v_ids;
  end if;

  for v_username in c_mention loop
    select id into v_user_id
    from public.profiles
    where name = v_username
    limit 1;
    if v_user_id is not null and not (v_user_id = any(v_ids)) then
      v_ids := array_append(v_ids, v_user_id);
    end if;
  end loop;

  return v_ids;
end $$;

revoke all on function public.extract_mentions(text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- notify_mentioned_users_from_body
-- Inserts a 'mention' notification for each mentioned user (skipping the
-- author themselves). Used by the per-table triggers below.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.notify_mentioned_users_from_body(
  p_body text,
  p_author_id uuid,
  p_entity_type text,
  p_entity_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mentioned uuid[];
  v_user_id uuid;
  v_author_name text;
  v_count int := 0;
begin
  if p_body is null or btrim(p_body) = '' or p_author_id is null then
    return 0;
  end if;

  v_mentioned := public.extract_mentions(p_body);
  if array_length(v_mentioned, 1) is null then
    return 0;
  end if;

  select name into v_author_name from public.profiles where id = p_author_id;

  foreach v_user_id in array v_mentioned loop
    if v_user_id = p_author_id then
      continue;
    end if;
    insert into public.notifications(recipient_id, actor_id, type, entity_type, entity_id, message)
    values (
      v_user_id,
      p_author_id,
      'mention',
      p_entity_type,
      p_entity_id,
      coalesce(v_author_name, 'Someone') || ' mentioned you'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

revoke all on function public.notify_mentioned_users_from_body(text, uuid, text, uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- comments mention trigger
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.trg_notify_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    perform public.notify_mentioned_users_from_body(new.body, new.creator_id, 'comment', new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_comments_mentions on public.comments;
create trigger trg_comments_mentions
  after insert on public.comments
  for each row execute function public.trg_notify_comment_mentions();

-- ─────────────────────────────────────────────────────────────────────
-- posts mention trigger
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.trg_notify_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    perform public.notify_mentioned_users_from_body(new.body, new.author_id, 'post', new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_posts_mentions on public.posts;
create trigger trg_posts_mentions
  after insert on public.posts
  for each row execute function public.trg_notify_post_mentions();

-- ─────────────────────────────────────────────────────────────────────
-- reference_thread_replies mention trigger
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.trg_notify_thread_reply_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    perform public.notify_mentioned_users_from_body(new.body, new.creator_id, 'comment', new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_thread_replies_mentions on public.reference_thread_replies;
create trigger trg_thread_replies_mentions
  after insert on public.reference_thread_replies
  for each row execute function public.trg_notify_thread_reply_mentions();

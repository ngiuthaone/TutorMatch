-- 20260915000010_fts_search_extension.sql
-- Full-text search infrastructure for posts, reference_threads, communities.
-- Adds tsvector columns maintained by triggers (weighted term importance),
-- GIN indexes for fast lookup, and a new search_full_text RPC for ranked queries.
--
-- The existing search_all RPC (ilike) remains unchanged for backwards compatibility.
-- This migration is additive: no existing column, policy, or RPC is modified.
--
-- Note: tsvector columns cannot be GENERATED ALWAYS AS STORED because the
-- expression `to_tsvector(regconfig, text)` is not IMMUTABLE (the regconfig is
-- looked up via a non-immutable cast). We use a trigger-maintained column
-- instead, which is the documented Postgres workaround.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- Helper: trigger function to refresh posts.search_vector
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.posts_search_vector_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.body, '')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(new.tags, '{}'::text[]), ' ')), 'B');
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- posts.search_vector: body (weight A) + tags (weight B)
-- ─────────────────────────────────────────────────────────────────────
alter table public.posts
  add column if not exists search_vector tsvector;

create index if not exists idx_posts_search
  on public.posts using gin (search_vector);

drop trigger if exists trg_posts_search_vector on public.posts;
create trigger trg_posts_search_vector
  before insert or update of body, tags on public.posts
  for each row execute function public.posts_search_vector_update();

-- Backfill any existing rows.
update public.posts set body = body where search_vector is null;

-- ─────────────────────────────────────────────────────────────────────
-- Helper: trigger function to refresh reference_threads.search_vector
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.reference_threads_search_vector_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.body, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(new.tags, '{}'::text[]), ' ')), 'C');
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- reference_threads.search_vector: title (A) + body (B) + tags (C)
-- ─────────────────────────────────────────────────────────────────────
alter table public.reference_threads
  add column if not exists search_vector tsvector;

create index if not exists idx_threads_search
  on public.reference_threads using gin (search_vector);

drop trigger if exists trg_reference_threads_search_vector on public.reference_threads;
create trigger trg_reference_threads_search_vector
  before insert or update of title, body, tags on public.reference_threads
  for each row execute function public.reference_threads_search_vector_update();

-- Backfill any existing rows.
update public.reference_threads set body = body where search_vector is null;

-- ─────────────────────────────────────────────────────────────────────
-- Helper: trigger function to refresh communities.search_vector
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.communities_search_vector_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'B');
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- communities.search_vector: name (A) + description (B)
-- ─────────────────────────────────────────────────────────────────────
alter table public.communities
  add column if not exists search_vector tsvector;

create index if not exists idx_communities_search
  on public.communities using gin (search_vector);

drop trigger if exists trg_communities_search_vector on public.communities;
create trigger trg_communities_search_vector
  before insert or update of name, description on public.communities
  for each row execute function public.communities_search_vector_update();

-- Backfill any existing rows.
update public.communities set name = name where search_vector is null;

-- ─────────────────────────────────────────────────────────────────────
-- search_full_text: ranked FTS across posts / threads / communities.
-- Same authorization model as search_all:
--   - posts/threads: post.community_id is null OR can_access_community(...)
--   - communities:   visibility = 'public' AND not archived
-- Same response shape as search_all: { posts, threads, communities, next_cursor }.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.search_full_text(
  p_query text,
  p_limit integer default 20,
  p_kind text default 'all'
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(coalesce(p_limit, 20), 50);
  v_q text;
  v_results jsonb;
  v_posts jsonb := '[]'::jsonb;
  v_threads jsonb := '[]'::jsonb;
  v_communities jsonb := '[]'::jsonb;
begin
  if p_query is null or btrim(p_query) = '' then
    return jsonb_build_object('posts', v_posts, 'threads', v_threads, 'communities', v_communities, 'next_cursor', null);
  end if;

  v_q := btrim(p_query);

  if p_kind in ('all', 'posts') then
    select coalesce(jsonb_agg(t.obj), '[]'::jsonb) into v_posts
    from (
      select jsonb_build_object(
        'id', p.id, 'body', p.body, 'tags', p.tags,
        'like_count', p.like_count, 'comment_count', (select count(*) from public.comments c where c.owner_type='post' and c.owner_id=p.id and c.status='published'),
        'author', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role),
        'community_id', p.community_id, 'created_at', p.created_at,
        'is_removed', p.is_removed,
        'rank', ts_rank(p.search_vector, websearch_to_tsquery('simple', v_q))
      ) obj
      from public.posts p
      left join public.profiles pr on pr.id = p.author_id
      where p.status = 'published'
        and p.search_vector @@ websearch_to_tsquery('simple', v_q)
        and (p.community_id is null or public.can_access_community(p.community_id))
      order by ts_rank(p.search_vector, websearch_to_tsquery('simple', v_q)) desc, p.created_at desc
      limit v_limit
    ) t;
  end if;

  if p_kind in ('all', 'threads') then
    select coalesce(jsonb_agg(t.obj), '[]'::jsonb) into v_threads
    from (
      select jsonb_build_object(
        'id', t.id, 'title', t.title, 'body', t.body,
        'anchor_type', t.anchor_type, 'anchor_title', t.anchor_title, 'anchor_domain', t.anchor_domain,
        'tags', t.tags, 'appreciated_count', t.appreciated_count, 'reply_count', t.reply_count,
        'creator', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role),
        'community_id', t.community_id, 'created_at', t.created_at,
        'status', t.status,
        'rank', ts_rank(t.search_vector, websearch_to_tsquery('simple', v_q))
      ) obj
      from public.reference_threads t
      left join public.profiles pr on pr.id = t.creator_id
      where t.status in ('published','closed')
        and t.search_vector @@ websearch_to_tsquery('simple', v_q)
        and (t.community_id is null or public.can_access_community(t.community_id))
      order by ts_rank(t.search_vector, websearch_to_tsquery('simple', v_q)) desc, t.created_at desc
      limit v_limit
    ) t;
  end if;

  if p_kind in ('all', 'communities') then
    select coalesce(jsonb_agg(t.obj), '[]'::jsonb) into v_communities
    from (
      select jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'name', c.name, 'description', c.description,
        'visibility', c.visibility, 'join_policy', c.join_policy,
        'member_count', c.member_count,
        'rank', ts_rank(c.search_vector, websearch_to_tsquery('simple', v_q))
      ) obj
      from public.communities c
      where c.archived_at is null
        and c.visibility = 'public'
        and c.search_vector @@ websearch_to_tsquery('simple', v_q)
      order by ts_rank(c.search_vector, websearch_to_tsquery('simple', v_q)) desc, c.member_count desc
      limit v_limit
    ) t;
  end if;

  v_results := jsonb_build_object(
    'posts', v_posts, 'threads', v_threads, 'communities', v_communities, 'next_cursor', null
  );
  return v_results;
end $$;

revoke all on function public.search_full_text(text, integer, text) from public, anon, authenticated;
grant execute on function public.search_full_text(text, integer, text) to anon, authenticated;

-- Note: search_vector columns inherit RLS from their parent tables (existing
-- posts / reference_threads / communities policies already cover SELECT).
-- No additional policies are required because the columns are not exposed
-- directly to clients; access is mediated by the security definer RPC.
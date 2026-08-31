-- 20260904000002_article_rpcs.sql
-- Security-definer RPCs for the article draft → publish lifecycle and public
-- read. Slug is always server-generated/validated; author_id = auth.uid();
-- content_html is sanitized server-side on every save/publish.
--
-- Contract: docs/REFERENCE_THREADS_PROMPT.md (Security-definer RPCs — Articles).
set search_path = '';

-- HTML sanitizer (defense-in-depth; mirrors the service sanitizer). Strips
-- dangerous blocks/tags/event-handler attrs and dangerous protocols so stored
-- content can never execute. The TipTap schema is the primary author; this is
-- the DB's last line.
create or replace function public._sanitize_html(input text)
returns text language plpgsql immutable as $$
declare
  v text := coalesce(input, '');
begin
  if char_length(v) > 500000 then v := left(v, 500000); end if;
  -- Remove dangerous paired blocks.
  v := regexp_replace(v, '<\s*(script|iframe|object|embed|frame|meta|link|base|form)\b[^>]*>[\s\S]*?<\s*/\s*\1\s*>', '', 'gi');
  -- Remove dangerous orphan tags.
  v := regexp_replace(v, '<\s*/?(?:script|iframe|object|embed|frame|meta|link|base|form)\b[^>]*>', '', 'gi');
  -- Remove on* event-handler attributes.
  v := regexp_replace(v, '\s+on[a-z][a-z0-9_-]*\s*=\s*("[^"]*"|''[^'']*''|[^\s>]+)', '', 'gi');
  -- Neutralize dangerous URL protocols.
  v := regexp_replace(v, '\b(javascript|vbscript|data):', '', 'gi');
  return v;
end $$;

-- Slug normalization (mirrors event-publication-service.normalizeRequestedSlug).
create or replace function public._normalize_article_slug(raw text)
returns text language plpgsql immutable as $$
declare
  v text;
begin
  v := lower(regexp_replace(btrim(coalesce(raw, '')), '[^a-z0-9]+', '-', 'g'));
  v := regexp_replace(v, '^-+|-+$', '', 'g');
  if char_length(v) > 116 then v := left(v, 116); end if;
  return v;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- create_article_draft
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.create_article_draft(
  p_title text,
  p_subtitle text default null,
  p_excerpt text default null,
  p_cover_image_url text default null,
  p_cover_image_alt text default null,
  p_content_html text default '',
  p_content_json jsonb default '{}'::jsonb,
  p_tags text[] default '{}',
  p_level text default null,
  p_estimated_reading_minutes integer default 1,
  p_comments_enabled boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_id uuid;
  v_html text;
begin
  if btrim(coalesce(p_title, '')) = '' then raise exception 'INVALID_TITLE' using errcode = '22023'; end if;
  if char_length(p_title) > 200 then raise exception 'INVALID_TITLE' using errcode = '22023'; end if;
  if p_excerpt is not null and char_length(p_excerpt) > 500 then raise exception 'INVALID_EXCERPT' using errcode = '22023'; end if;
  if p_cover_image_url is not null and (p_cover_image_url !~ '^https://[^\s]+$' or char_length(p_cover_image_url) > 2048) then
    raise exception 'INVALID_COVER_URL' using errcode = '22023';
  end if;
  if p_content_json is null or jsonb_typeof(p_content_json) != 'object' then
    p_content_json := '{}'::jsonb;
  end if;
  if octet_length(p_content_json::text) > 2000000 then
    raise exception 'CONTENT_TOO_LARGE' using errcode = '22023';
  end if;
  v_html := public._sanitize_html(coalesce(p_content_html, ''));
  -- Reject (not silently strip) HTML that the sanitizer had to alter.
  if v_html is distinct from coalesce(p_content_html, '') then
    raise exception 'UNSAFE_CONTENT' using errcode = '22023';
  end if;

  insert into public.articles(
    author_id, slug, title, subtitle, excerpt, cover_image_url, cover_image_alt,
    content_html, content_json, tags, level, estimated_reading_minutes, comments_enabled, status
  ) values (
    uid, 'draft-' || substr(md5(random()::text), 1, 12), btrim(p_title), nullif(btrim(p_subtitle), ''),
    nullif(btrim(p_excerpt), ''), p_cover_image_url, nullif(btrim(p_cover_image_alt), ''),
    v_html, p_content_json, coalesce(p_tags, '{}'), p_level,
    greatest(coalesce(p_estimated_reading_minutes, 1), 1), coalesce(p_comments_enabled, true), 'draft'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'draft');
end $$;

revoke all on function public.create_article_draft(text, text, text, text, text, text, jsonb, text[], text, integer, boolean) from public, anon, authenticated;
grant execute on function public.create_article_draft(text, text, text, text, text, text, jsonb, text[], text, integer, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- update_article_draft — author only, status must be 'draft'
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.update_article_draft(
  p_id uuid,
  p_title text default null,
  p_subtitle text default null,
  p_excerpt text default null,
  p_cover_image_url text default null,
  p_cover_image_alt text default null,
  p_content_html text default null,
  p_content_json jsonb default null,
  p_tags text[] default null,
  p_level text default null,
  p_estimated_reading_minutes integer default null,
  p_comments_enabled boolean default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_author uuid;
  v_status text;
  v_html text;
begin
  select author_id, status into v_author, v_status from public.articles where id = p_id;
  if v_author is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_author != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_status != 'draft' then raise exception 'NOT_DRAFT' using errcode = 'P0001'; end if;

  if p_content_json is not null and octet_length(p_content_json::text) > 2000000 then
    raise exception 'CONTENT_TOO_LARGE' using errcode = '22023';
  end if;
  v_html := case when p_content_html is not null then public._sanitize_html(p_content_html) else null end;
  -- Reject (not silently strip) HTML that the sanitizer had to alter.
  if p_content_html is not null and v_html is distinct from p_content_html then
    raise exception 'UNSAFE_CONTENT' using errcode = '22023';
  end if;

  update public.articles set
    title = coalesce(btrim(p_title), title),
    subtitle = case when p_subtitle is not null then nullif(btrim(p_subtitle), '') else subtitle end,
    excerpt = case when p_excerpt is not null then nullif(btrim(p_excerpt), '') else excerpt end,
    cover_image_url = coalesce(p_cover_image_url, cover_image_url),
    cover_image_alt = case when p_cover_image_alt is not null then nullif(btrim(p_cover_image_alt), '') else cover_image_alt end,
    content_html = coalesce(v_html, content_html),
    content_json = coalesce(p_content_json, content_json),
    tags = coalesce(p_tags, tags),
    level = coalesce(p_level, level),
    estimated_reading_minutes = coalesce(greatest(coalesce(p_estimated_reading_minutes, 1), 1), estimated_reading_minutes),
    comments_enabled = coalesce(p_comments_enabled, comments_enabled)
  where id = p_id;

  return jsonb_build_object('id', p_id, 'status', 'draft');
end $$;

revoke all on function public.update_article_draft(uuid, text, text, text, text, text, text, jsonb, text[], text, integer, boolean) from public, anon, authenticated;
grant execute on function public.update_article_draft(uuid, text, text, text, text, text, text, jsonb, text[], text, integer, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- publish_article — author only, generates/validates slug, atomic
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.publish_article(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_author uuid;
  v_status text;
  v_title text;
  v_base text;
  v_candidate text;
  v_suffix int := 1;
  v_max_suffix constant int := 999;
begin
  select author_id, status, title into v_author, v_status, v_title from public.articles where id = p_id;
  if v_author is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_author != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_status != 'draft' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;

  v_base := public._normalize_article_slug(v_title);
  if v_base = '' then raise exception 'INVALID_SLUG' using errcode = '22023'; end if;

  v_candidate := v_base;
  loop
    begin
      update public.articles
        set slug = v_candidate, status = 'published', published_at = now()
        where id = p_id and status = 'draft'
        and not exists(select 1 from public.articles where slug = v_candidate and id != p_id);
      if found then exit; end if;
      v_suffix := v_suffix + 1;
      if v_suffix > v_max_suffix then raise exception 'SLUG_EXHAUSTED' using errcode = '22023'; end if;
      v_candidate := v_base || '-' || v_suffix::text;
    end;
  end loop;

  return jsonb_build_object('id', p_id, 'slug', v_candidate, 'status', 'published');
end $$;

revoke all on function public.publish_article(uuid) from public, anon, authenticated;
grant execute on function public.publish_article(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- unpublish_article — author only, status → 'draft'
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.unpublish_article(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_author uuid;
begin
  select author_id into v_author from public.articles where id = p_id;
  if v_author is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_author != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.articles set status = 'draft', published_at = null where id = p_id and status = 'published';
  return jsonb_build_object('id', p_id, 'status', 'draft');
end $$;
revoke all on function public.unpublish_article(uuid) from public, anon, authenticated;
grant execute on function public.unpublish_article(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- delete_article — author only, soft-delete
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.delete_article(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := public.assert_verified_booking_caller(); v_author uuid;
begin
  select author_id into v_author from public.articles where id = p_id;
  if v_author is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_author != uid then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.articles set status = 'deleted' where id = p_id and status in ('draft','published');
  return jsonb_build_object('id', p_id, 'status', 'deleted');
end $$;
revoke all on function public.delete_article(uuid) from public, anon, authenticated;
grant execute on function public.delete_article(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- get_public_article_by_slug — public, published only, strips author_id
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.get_public_article_by_slug(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_row jsonb;
begin
  select jsonb_build_object(
    'id', a.id,
    'slug', a.slug,
    'title', a.title,
    'subtitle', a.subtitle,
    'excerpt', a.excerpt,
    'cover_image_url', a.cover_image_url,
    'cover_image_alt', a.cover_image_alt,
    'content_html', a.content_html,
    'tags', a.tags,
    'level', a.level,
    'estimated_reading_minutes', a.estimated_reading_minutes,
    'comments_enabled', a.comments_enabled,
    'published_at', a.published_at,
    'updated_at', a.updated_at,
    'is_author', (a.author_id = v_auth_uid),
    'author', jsonb_build_object('name', p.name, 'avatar_url', p.avatar_url, 'role', p.role)
  )
  into v_row
  from public.articles a
  left join public.profiles p on p.id = a.author_id
  where a.slug = p_slug and a.status = 'published';

  return v_row;
end $$;

revoke all on function public.get_public_article_by_slug(text) from public, anon, authenticated;
grant execute on function public.get_public_article_by_slug(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_public_articles — public, paginated by published_at desc
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_public_articles(
  p_cursor text default null,
  p_limit integer default 20,
  p_tag text default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(coalesce(p_limit, 20), 50);
  v_articles jsonb;
  v_next_cursor text;
begin
  select coalesce(jsonb_agg(t.obj order by t.published_at desc), '[]'::jsonb)
  into v_articles
  from (
    select jsonb_build_object(
      'id', a.id,
      'slug', a.slug,
      'title', a.title,
      'subtitle', a.subtitle,
      'excerpt', a.excerpt,
      'cover_image_url', a.cover_image_url,
      'tags', a.tags,
      'level', a.level,
      'estimated_reading_minutes', a.estimated_reading_minutes,
      'published_at', a.published_at,
      'author', jsonb_build_object('name', p.name, 'avatar_url', p.avatar_url, 'role', p.role)
    ) obj, a.published_at
    from public.articles a
    left join public.profiles p on p.id = a.author_id
    where a.status = 'published'
      and (p_cursor is null or a.published_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(a.tags))
    order by a.published_at desc
    limit v_limit
  ) t;

  select t.published_at into v_next_cursor
  from (
    select a.published_at
    from public.articles a
    where a.status = 'published'
      and (p_tag is null or p_tag = any(a.tags))
    order by a.published_at desc
    limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'articles', v_articles,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor) * 1000.0 end
  );
end $$;

revoke all on function public.list_public_articles(text, integer, text) from public, anon, authenticated;
grant execute on function public.list_public_articles(text, integer, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- list_my_articles — author's own drafts + published (for editor)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_my_articles()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  return (
    select jsonb_build_object('articles', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id, 'slug', a.slug, 'title', a.title, 'status', a.status,
        'updated_at', a.updated_at, 'published_at', a.published_at
      ) order by a.updated_at desc
    ), '[]'::jsonb))
    from public.articles a
    where a.author_id = uid and a.status in ('draft','published')
  );
end $$;

revoke all on function public.list_my_articles() from public, anon, authenticated;
grant execute on function public.list_my_articles() to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- get_my_article — author-only full draft/published content for editing
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.get_my_article(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); v_row jsonb;
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  select jsonb_build_object(
    'id', a.id, 'slug', a.slug, 'title', a.title, 'subtitle', a.subtitle,
    'excerpt', a.excerpt, 'cover_image_url', a.cover_image_url,
    'cover_image_alt', a.cover_image_alt, 'content_html', a.content_html,
    'content_json', a.content_json, 'tags', a.tags, 'level', a.level,
    'estimated_reading_minutes', a.estimated_reading_minutes,
    'comments_enabled', a.comments_enabled, 'status', a.status,
    'published_at', a.published_at, 'updated_at', a.updated_at
  )
  into v_row
  from public.articles a
  where a.id = p_id and a.author_id = uid and a.status in ('draft','published');
  return v_row;
end $$;

revoke all on function public.get_my_article(uuid) from public, anon, authenticated;
grant execute on function public.get_my_article(uuid) to authenticated;

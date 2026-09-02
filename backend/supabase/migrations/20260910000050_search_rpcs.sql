-- 20260910000050_search_rpcs.sql
-- Cross-entity search for posts, threads, communities.
-- Uses substring matching (ilike) — no new extensions required.
-- Authorization enforced via can_access_community helper from 20260908000013.
set search_path = '';

create or replace function public.search_all(
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
  v_q := '%' || lower(btrim(p_query)) || '%';

  if p_kind in ('all', 'posts') then
    select coalesce(jsonb_agg(t.obj), '[]'::jsonb) into v_posts
    from (
      select jsonb_build_object(
        'id', p.id, 'body', p.body, 'tags', p.tags,
        'like_count', p.like_count, 'comment_count', (select count(*) from public.comments c where c.owner_type='post' and c.owner_id=p.id and c.status='published'),
        'author', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role),
        'community_id', p.community_id, 'created_at', p.created_at,
        'is_removed', p.is_removed
      ) obj
      from public.posts p
      left join public.profiles pr on pr.id = p.author_id
      where p.status = 'published'
        and (lower(p.body) like v_q or exists (select 1 from unnest(p.tags) tag where lower(tag) like v_q))
        and (p.community_id is null or public.can_access_community(p.community_id))
      order by p.created_at desc
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
        'status', t.status
      ) obj
      from public.reference_threads t
      left join public.profiles pr on pr.id = t.creator_id
      where t.status in ('published','closed')
        and (lower(t.title) like v_q or coalesce(lower(t.body), '') like v_q or exists (select 1 from unnest(t.tags) tag where lower(tag) like v_q))
        and (t.community_id is null or public.can_access_community(t.community_id))
      order by t.created_at desc
      limit v_limit
    ) t;
  end if;

  if p_kind in ('all', 'communities') then
    select coalesce(jsonb_agg(t.obj), '[]'::jsonb) into v_communities
    from (
      select jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'name', c.name, 'description', c.description,
        'visibility', c.visibility, 'join_policy', c.join_policy,
        'member_count', c.member_count
      ) obj
      from public.communities c
      where c.archived_at is null
        and c.visibility = 'public'
        and (lower(c.name) like v_q or coalesce(lower(c.description), '') like v_q)
      order by c.member_count desc
      limit v_limit
    ) t;
  end if;

  v_results := jsonb_build_object(
    'posts', v_posts, 'threads', v_threads, 'communities', v_communities, 'next_cursor', null
  );
  return v_results;
end $$;

revoke all on function public.search_all(text, integer, text) from public, anon, authenticated;
grant execute on function public.search_all(text, integer, text) to anon, authenticated;

-- 20260908000003_community_security_fixes.sql
-- Critical security fixes for community integration with posts/threads.
-- Addresses: community membership bypass, banned users posting,
-- private community content leaking via public list/get RPCs.
set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- add_community_id_to_list_posts / add_community_id_to_list_threads
-- helper: check if user is a non-banned active member of a community
-- Returns true if:
--   - community is public, OR
--   - user is an active (non-banned) member
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.can_access_community(p_community_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_visibility text;
begin
  select visibility into v_visibility from public.communities where id = p_community_id and archived_at is null;
  if v_visibility is null then return false; end if;
  if v_visibility = 'public' then return true; end if;
  -- private: require active (non-banned) member
  return exists(
    select 1 from public.community_members
    where community_id = p_community_id and user_id = auth.uid() and status = 'active'
  );
end $$;

revoke all on function public.can_access_community(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Replace create_post — add community membership check
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.create_post(
  p_body text,
  p_tags text[] default '{}',
  p_level text default null,
  p_post_type text default null,
  p_reply_permission text default 'everyone',
  p_community_id uuid default null,
  p_image_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_id uuid;
begin
  if btrim(coalesce(p_body, '')) = '' then raise exception 'INVALID_BODY' using errcode = '22023'; end if;
  if char_length(p_body) > 5000 then raise exception 'BODY_TOO_LARGE' using errcode = '22023'; end if;
  if p_post_type is not null and p_post_type not in ('insight','question','tip','tutorial','experience','project','discussion') then
    raise exception 'INVALID_TYPE' using errcode = '22023';
  end if;
  if p_reply_permission is not null and p_reply_permission not in ('everyone','community_members','disabled') then
    raise exception 'INVALID_PERMISSION' using errcode = '22023';
  end if;

  -- Community access check: if community_id is set, caller must be a non-banned active member
  if p_community_id is not null then
    if not exists(
      select 1 from public.community_members
      where community_id = p_community_id and user_id = uid and status = 'active'
    ) then
      raise exception 'COMMUNITY_ACCESS_DENIED' using errcode = '42501';
    end if;
    -- If reply_permission = 'community_members', the community check above is sufficient
  end if;

  insert into public.posts(author_id, body, tags, level, post_type, reply_permission, community_id, status, image_url)
  values (uid, btrim(p_body), coalesce(p_tags, '{}'), p_level, p_post_type, coalesce(p_reply_permission, 'everyone'), p_community_id, 'published', p_image_url)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'published');
end $$;

revoke all on function public.create_post(text, text[], text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_post(text, text[], text, text, text, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Replace create_reference_thread — add community membership check
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.create_reference_thread(
  p_title text,
  p_body text default null,
  p_anchor_type text default 'external_url',
  p_anchor_id uuid default null,
  p_anchor_url text default null,
  p_anchor_title text default null,
  p_anchor_domain text default null,
  p_tags text[] default '{}',
  p_level text default null,
  p_visibility text default 'public',
  p_community_id uuid default null,
  p_reply_permission text default 'everyone'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_id uuid;
  v_anchor_id uuid := p_anchor_id;
  v_anchor_url text := p_anchor_url;
begin
  if btrim(coalesce(p_title, '')) = '' then raise exception 'INVALID_TITLE' using errcode = '22023'; end if;
  if char_length(p_title) > 200 then raise exception 'TITLE_TOO_LONG' using errcode = '22023'; end if;
  if p_body is not null and char_length(p_body) > 2000 then raise exception 'BODY_TOO_LONG' using errcode = '22023'; end if;
  if p_anchor_type not in ('course','event','workshop','article','tutor_profile','external_url') then
    raise exception 'INVALID_ANCHOR_TYPE' using errcode = '22023';
  end if;
  if p_visibility not in ('public','community') then raise exception 'INVALID_VISIBILITY' using errcode = '22023'; end if;
  if p_reply_permission not in ('everyone','community_members','disabled') then raise exception 'INVALID_REPLY_PERMISSION' using errcode = '22023'; end if;
  if p_level is not null and p_level not in ('complete_beginner','beginner','intermediate','advanced','all_levels') then
    raise exception 'INVALID_LEVEL' using errcode = '22023';
  end if;

  if p_anchor_type = 'external_url' then
    if p_anchor_url is null or p_anchor_url !~ '^https?://' then
      raise exception 'INVALID_ANCHOR_URL' using errcode = '22023';
    end if;
    v_anchor_id := null;
  else
    v_anchor_url := null;
    if v_anchor_id is null then raise exception 'ANCHOR_ID_REQUIRED' using errcode = '22023'; end if;
  end if;

  if p_visibility = 'community' and p_community_id is null then
    raise exception 'COMMUNITY_ID_REQUIRED' using errcode = '22023';
  end if;

  -- Community access check: if community_id is set, caller must be a non-banned active member
  if p_community_id is not null then
    if not exists(
      select 1 from public.community_members
      where community_id = p_community_id and user_id = uid and status = 'active'
    ) then
      raise exception 'COMMUNITY_ACCESS_DENIED' using errcode = '42501';
    end if;
  end if;

  insert into public.reference_threads(
    creator_id, title, body, anchor_type, anchor_id, anchor_url,
    anchor_title, anchor_domain, tags, level, visibility, community_id,
    reply_permission, status
  )
  values (
    uid, btrim(p_title), p_body, p_anchor_type, v_anchor_id, v_anchor_url,
    p_anchor_title, p_anchor_domain, coalesce(p_tags, '{}'), p_level, p_visibility,
    p_community_id, p_reply_permission, 'published'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'published');
end $$;

revoke all on function public.create_reference_thread(text, text, text, uuid, text, text, text, text[], text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_reference_thread(text, text, text, uuid, text, text, text, text[], text, text, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Replace reply_to_thread — add community membership check
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.reply_to_thread(
  p_thread_id uuid,
  p_body text,
  p_parent_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.assert_verified_booking_caller();
  v_thread_status text;
  v_reply_permission text;
  v_thread_community_id uuid;
  v_depth int := 1;
  v_parent_depth int := 0;
  v_id uuid;
begin
  if btrim(coalesce(p_body, '')) = '' or char_length(p_body) > 2000 then
    raise exception 'INVALID_BODY' using errcode = '22023';
  end if;

  select status, reply_permission, community_id into v_thread_status, v_reply_permission, v_thread_community_id
  from public.reference_threads where id = p_thread_id;
  if v_thread_status is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_thread_status != 'published' then raise exception 'THREAD_CLOSED' using errcode = 'P0001'; end if;

  -- Community membership check for community-scoped threads
  if v_thread_community_id is not null then
    if not exists(
      select 1 from public.community_members
      where community_id = v_thread_community_id and user_id = uid and status = 'active'
    ) then
      raise exception 'COMMUNITY_ACCESS_DENIED' using errcode = '42501';
    end if;
  end if;

  if v_reply_permission = 'community_members' then
    -- Thread is community-only; if it has no community_id, the reply_permission setting is ambiguous; require membership of any community = false; skip
    if v_thread_community_id is not null then
      if not exists(
        select 1 from public.community_members
        where community_id = v_thread_community_id and user_id = uid and status = 'active'
      ) then
        raise exception 'REPLIES_RESTRICTED' using errcode = '42501';
      end if;
    end if;
  end if;
  if v_reply_permission = 'disabled' then raise exception 'REPLIES_DISABLED' using errcode = 'P0001'; end if;

  if p_parent_id is not null then
    with recursive ancestors as (
      select id, parent_id, 1 as depth from public.reference_thread_replies
      where id = p_parent_id and status = 'published'
      union all
      select r2.id, r2.parent_id, a.depth + 1 from public.reference_thread_replies r2
      join ancestors a on r2.id = a.parent_id where r2.status = 'published'
    )
    select max(depth) into v_parent_depth from ancestors;
    v_depth := v_parent_depth + 1;
    if v_depth > 3 then raise exception 'DEPTH_EXCEEDED' using errcode = 'P0001'; end if;
  end if;

  insert into public.reference_thread_replies(thread_id, parent_id, creator_id, body, status)
  values (p_thread_id, p_parent_id, uid, btrim(p_body), 'published')
  returning id into v_id;

  update public.reference_threads set reply_count = reply_count + 1 where id = p_thread_id;

  return jsonb_build_object('id', v_id, 'depth', v_depth, 'status', 'published');
end $$;

revoke all on function public.reply_to_thread(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reply_to_thread(uuid, text, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Add p_community_id to list_public_posts
-- Also enforce: if filtering by community, caller must be allowed to see it
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_public_posts(
  p_cursor text default null,
  p_limit integer default 20,
  p_tag text default null,
  p_post_type text default null,
  p_author_name text default null,
  p_community_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(coalesce(p_limit, 20), 50);
  v_auth_uid uuid := auth.uid();
  v_posts jsonb;
  v_next_cursor text;
begin
  -- If filtering by community, verify the caller can access it
  if p_community_id is not null and not public.can_access_community(p_community_id) then
    return jsonb_build_object('posts', '[]'::jsonb, 'next_cursor', null);
  end if;

  select coalesce(jsonb_agg(t.obj order by t.created_at desc), '[]'::jsonb)
  into v_posts
  from (
    select jsonb_build_object(
      'id', p.id,
      'body', p.body,
      'tags', p.tags,
      'level', p.level,
      'post_type', p.post_type,
      'reply_permission', p.reply_permission,
      'like_count', p.like_count,
      'repost_count', p.repost_count,
      'comment_count', (select count(*) from public.comments c where c.owner_type = 'post' and c.owner_id = p.id and c.status = 'published'),
      'image_url', p.image_url,
      'community_id', p.community_id,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'is_author', (p.author_id = v_auth_uid),
      'liked_by_me', exists(select 1 from public.post_likes l where l.post_id = p.id and l.user_id = v_auth_uid),
      'reposted_by_me', exists(select 1 from public.post_reposts r where r.post_id = p.id and r.user_id = v_auth_uid),
      'author', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role)
    ) obj, p.created_at
    from public.posts p
    left join public.profiles pr on pr.id = p.author_id
    where p.status = 'published'
      and (p_community_id is null or p.community_id = p_community_id)
      -- Exclude posts in private communities that the caller cannot access
      and (p.community_id is null or public.can_access_community(p.community_id))
      and (p_cursor is null or p.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(p.tags))
      and (p_post_type is null or p.post_type = p_post_type)
      and (p_author_name is null or pr.name = p_author_name)
    order by p.created_at desc
    limit v_limit
  ) t;

  select t.created_at into v_next_cursor
  from (
    select p.created_at
    from public.posts p
    left join public.profiles pr on pr.id = p.author_id
    where p.status = 'published'
      and (p_community_id is null or p.community_id = p_community_id)
      and (p.community_id is null or public.can_access_community(p.community_id))
      and (p_cursor is null or p.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(p.tags))
      and (p_post_type is null or p.post_type = p_post_type)
      and (p_author_name is null or pr.name = p_author_name)
    order by p.created_at desc
    limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'posts', v_posts,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor::timestamptz) * 1000.0 end
  );
end $$;

revoke all on function public.list_public_posts(text, integer, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.list_public_posts(text, integer, text, text, text, uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Replace get_public_post — enforce community access
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.get_public_post(p_id uuid)
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
    'id', p.id,
    'body', p.body,
    'tags', p.tags,
    'level', p.level,
    'post_type', p.post_type,
    'reply_permission', p.reply_permission,
    'like_count', p.like_count,
    'repost_count', p.repost_count,
    'comment_count', (select count(*) from public.comments c where c.owner_type = 'post' and c.owner_id = p.id and c.status = 'published'),
    'image_url', p.image_url,
    'community_id', p.community_id,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'is_author', (p.author_id = v_auth_uid),
    'liked_by_me', exists(select 1 from public.post_likes l where l.post_id = p.id and l.user_id = v_auth_uid),
    'reposted_by_me', exists(select 1 from public.post_reposts r where r.post_id = p.id and r.user_id = v_auth_uid),
    'author', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role)
  ) into v_row
  from public.posts p
  left join public.profiles pr on pr.id = p.author_id
  where p.id = p_id
    and p.status = 'published'
    and (p.community_id is null or public.can_access_community(p.community_id));

  return v_row;
end $$;

revoke all on function public.get_public_post(uuid) from public, anon, authenticated;
grant execute on function public.get_public_post(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Add p_community_id to list_reference_threads
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.list_reference_threads(
  p_cursor text default null,
  p_limit integer default 20,
  p_tag text default null,
  p_level text default null,
  p_anchor_type text default null,
  p_community_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(coalesce(p_limit, 20), 50);
  v_auth_uid uuid := auth.uid();
  v_threads jsonb;
  v_next_cursor text;
begin
  if p_community_id is not null and not public.can_access_community(p_community_id) then
    return jsonb_build_object('threads', '[]'::jsonb, 'next_cursor', null);
  end if;

  select coalesce(jsonb_agg(t.obj order by t.created_at desc), '[]'::jsonb)
  into v_threads
  from (
    select jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'body', t.body,
      'anchor_type', t.anchor_type,
      'anchor_id', t.anchor_id,
      'anchor_url', t.anchor_url,
      'anchor_title', t.anchor_title,
      'anchor_domain', t.anchor_domain,
      'tags', t.tags,
      'level', t.level,
      'visibility', t.visibility,
      'reply_permission', t.reply_permission,
      'community_id', t.community_id,
      'appreciated_count', t.appreciated_count,
      'reply_count', t.reply_count,
      'status', t.status,
      'is_creator', (t.creator_id = v_auth_uid),
      'appreciated_by_me', exists(
        select 1 from public.reference_thread_appreciations a
        where a.target_type = 'thread' and a.target_id = t.id and a.user_id = v_auth_uid
      ),
      'creator', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role),
      'created_at', t.created_at,
      'updated_at', t.updated_at
    ) obj, t.created_at
    from public.reference_threads t
    left join public.profiles pr on pr.id = t.creator_id
    where t.status in ('published', 'closed')
      and (p_community_id is null or t.community_id = p_community_id)
      and (t.community_id is null or public.can_access_community(t.community_id))
      and (p_cursor is null or t.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(t.tags))
      and (p_level is null or t.level = p_level)
      and (p_anchor_type is null or t.anchor_type = p_anchor_type)
    order by t.created_at desc
    limit v_limit
  ) t;

  select t.created_at into v_next_cursor
  from (
    select t.created_at
    from public.reference_threads t
    where t.status in ('published', 'closed')
      and (p_community_id is null or t.community_id = p_community_id)
      and (t.community_id is null or public.can_access_community(t.community_id))
      and (p_cursor is null or t.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(t.tags))
      and (p_level is null or t.level = p_level)
      and (p_anchor_type is null or t.anchor_type = p_anchor_type)
    order by t.created_at desc
    limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'threads', v_threads,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor::timestamptz) * 1000.0 end
  );
end $$;

revoke all on function public.list_reference_threads(text, integer, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.list_reference_threads(text, integer, text, text, text, uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Replace get_reference_thread — enforce community access
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.get_reference_thread(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_thread jsonb;
begin
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'body', t.body,
    'anchor_type', t.anchor_type,
    'anchor_id', t.anchor_id,
    'anchor_url', t.anchor_url,
    'anchor_title', t.anchor_title,
    'anchor_domain', t.anchor_domain,
    'tags', t.tags,
    'level', t.level,
    'visibility', t.visibility,
    'reply_permission', t.reply_permission,
    'community_id', t.community_id,
    'appreciated_count', t.appreciated_count,
    'reply_count', t.reply_count,
    'status', t.status,
    'is_creator', (t.creator_id = v_auth_uid),
    'appreciated_by_me', exists(
      select 1 from public.reference_thread_appreciations a
      where a.target_type = 'thread' and a.target_id = t.id and a.user_id = v_auth_uid
    ),
    'creator', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role),
    'created_at', t.created_at,
    'updated_at', t.updated_at
  ) into v_thread
  from public.reference_threads t
  left join public.profiles pr on pr.id = t.creator_id
  where t.id = p_id
    and t.status in ('published', 'closed')
    and (t.community_id is null or public.can_access_community(t.community_id));

  return v_thread;
end $$;

revoke all on function public.get_reference_thread(uuid) from public, anon, authenticated;
grant execute on function public.get_reference_thread(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Post / thread count triggers (fix #7: counters never increment)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.sync_community_post_count()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (TG_OP = 'INSERT' and new.status = 'published' and new.community_id is not null) then
    update public.communities set post_count = post_count + 1 where id = new.community_id;
  elsif (TG_OP = 'DELETE' and old.status = 'published' and old.community_id is not null) then
    update public.communities set post_count = greatest(post_count - 1, 0) where id = old.community_id;
  elsif (TG_OP = 'UPDATE') then
    -- status changed to deleted/removed
    if old.status = 'published' and new.status <> 'published' and old.community_id is not null then
      update public.communities set post_count = greatest(post_count - 1, 0) where id = old.community_id;
    elsif old.status <> 'published' and new.status = 'published' and new.community_id is not null then
      update public.communities set post_count = post_count + 1 where id = new.community_id;
    end if;
    -- community changed while published
    if old.status = 'published' and new.status = 'published'
       and old.community_id is distinct from new.community_id then
      if old.community_id is not null then
        update public.communities set post_count = greatest(post_count - 1, 0) where id = old.community_id;
      end if;
      if new.community_id is not null then
        update public.communities set post_count = post_count + 1 where id = new.community_id;
      end if;
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_community_post_count on public.posts;
create trigger trg_community_post_count
  after insert or update or delete on public.posts
  for each row execute function public.sync_community_post_count();

create or replace function public.sync_community_thread_count()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (TG_OP = 'INSERT' and new.status in ('published','closed') and new.community_id is not null) then
    update public.communities set thread_count = thread_count + 1 where id = new.community_id;
  elsif (TG_OP = 'DELETE' and old.status in ('published','closed') and old.community_id is not null) then
    update public.communities set thread_count = greatest(thread_count - 1, 0) where id = old.community_id;
  elsif (TG_OP = 'UPDATE') then
    if old.status in ('published','closed') and new.status not in ('published','closed') and old.community_id is not null then
      update public.communities set thread_count = greatest(thread_count - 1, 0) where id = old.community_id;
    elsif old.status not in ('published','closed') and new.status in ('published','closed') and new.community_id is not null then
      update public.communities set thread_count = thread_count + 1 where id = new.community_id;
    end if;
    if old.status in ('published','closed') and new.status in ('published','closed')
       and old.community_id is distinct from new.community_id then
      if old.community_id is not null then
        update public.communities set thread_count = greatest(thread_count - 1, 0) where id = old.community_id;
      end if;
      if new.community_id is not null then
        update public.communities set thread_count = thread_count + 1 where id = new.community_id;
      end if;
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_community_thread_count on public.reference_threads;
create trigger trg_community_thread_count
  after insert or update or delete on public.reference_threads
  for each row execute function public.sync_community_thread_count();

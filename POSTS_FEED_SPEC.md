# Posts: per-user "For you" / "Following" feeds — implementation spec

Goal: make the two posts dashboard tabs behave like social apps (Threads/Bluesky/X), where different signed-in users see different, personalized dashboards.

## Auth policy (decision to confirm)
- `list_for_you_posts` — requires auth (uses `auth.uid()`). When the caller is **unauthenticated**, fall back to the global `list_public_posts` RPC so the public feed still loads (matches current behavior).
- `list_following_posts` — requires auth (follow graph via `auth.uid()`). Return 401 if unauthenticated (a Following feed with no follow graph is meaningless).
- For You ranking = engagement(like_count + repost_count + comment_count) × recency, excluding posts by the author themselves and (best-effort) already-seen via cursor pagination. This is a simple, dependency-free algo that needs no ML.

## 1. New SQL RPC: `list_for_you_posts`  (migration: `20260917000001_for_you_posts_rpc.sql`)

```sql
-- Security-definer RPC: algorithmic, per-user "For you" feed.
set search_path = '';

create or replace function public.list_for_you_posts(
  p_cursor text default null,
  p_limit integer default 20,
  p_tag text default null,
  p_post_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(coalesce(p_limit, 20), 50);
  v_uid uuid := auth.uid();
  v_posts jsonb;
  v_next_cursor text;
begin
  -- Ranking: weighted engagement score * recency. Auth.uid() used to
  -- exclude the caller's own posts and to power per-user liked_by_me.
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
      'is_author', (p.author_id = v_uid),
      'liked_by_me', exists(select 1 from public.post_likes l where l.post_id = p.id and l.user_id = v_uid),
      'reposted_by_me', exists(select 1 from public.post_reposts r where r.post_id = p.id and r.user_id = v_uid),
      'author', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role)
    ) obj,
    -- engagement+recency score so the outer ORDER BY keeps the same window for cursor math
    ( (p.like_count * 1.0) + (p.repost_count * 0.5) + (p.comment_count * 0.5) ) as eng
    from public.posts p
    left join public.profiles pr on pr.id = p.author_id
    where p.status = 'published'
      and (v_uid is null or p.author_id <> v_uid)
      and (p_cursor is null or p.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(p.tags))
      and (p_post_type is null or p.post_type = p_post_type)
    order by eng desc, p.created_at desc
    limit v_limit
  ) t;

  select t.created_at into v_next_cursor
  from (
    select p.created_at
    from public.posts p
    left join public.profiles pr on pr.id = p.author_id
    where p.status = 'published'
      and (v_uid is null or p.author_id <> v_uid)
      and (p_cursor is null or p.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(p.tags))
      and (p_post_type is null or p.post_type = p_post_type)
    order by ((p.like_count * 1.0) + (p.repost_count * 0.5) + (p.comment_count * 0.5)) desc, p.created_at desc
    limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'posts', v_posts,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor) * 1000.0 end
  );
end $$;

revoke all on function public.list_for_you_posts(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.list_for_you_posts(text, integer, text, text) to anon, authenticated;
```

> Note: `v_uid` can be null for anon; `p.author_id <> v_uid` short-circuits safely when null via the `v_uid is null` guard. `is_author`/`liked_by_me`/`reposted_by_me` resolve to false for anon.

## 2. New SQL RPC: `list_following_posts`  (same migration)

```sql
create or replace function public.list_following_posts(
  p_cursor text default null,
  p_limit integer default 20,
  p_tag text default null,
  p_post_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(coalesce(p_limit, 20), 50);
  v_uid uuid := auth.uid();
  v_posts jsonb;
  v_next_cursor text;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
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
      'is_author', (p.author_id = v_uid),
      'liked_by_me', exists(select 1 from public.post_likes l where l.post_id = p.id and l.user_id = v_uid),
      'reposted_by_me', exists(select 1 from public.post_reposts r where r.post_id = p.id and r.user_id = v_uid),
      'author', jsonb_build_object('name', pr.name, 'avatar_url', pr.avatar_url, 'role', pr.role)
    ) obj, p.created_at
    from public.posts p
    left join public.profiles pr on pr.id = p.author_id
    where p.status = 'published'
      and p.author_id in (select followee_id from public.follows where follower_id = v_uid)
      and (p_cursor is null or p.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(p.tags))
      and (p_post_type is null or p.post_type = p_post_type)
    order by p.created_at desc
    limit v_limit
  ) t;

  select t.created_at into v_next_cursor
  from (
    select p.created_at
    from public.posts p
    left join public.profiles pr on pr.id = p.author_id
    where p.status = 'published'
      and p.author_id in (select followee_id from public.follows where follower_id = v_uid)
      and (p_cursor is null or p.created_at < to_timestamp(p_cursor::double precision / 1000.0))
      and (p_tag is null or p_tag = any(p.tags))
      and (p_post_type is null or p.post_type = p_post_type)
    order by p.created_at desc
    limit 1 offset v_limit
  ) t;

  return jsonb_build_object(
    'posts', v_posts,
    'next_cursor', case when v_next_cursor is not null then extract(epoch from v_next_cursor) * 1000.0 end
  );
end $$;

revoke all on function public.list_following_posts(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.list_following_posts(text, integer, text, text) to authenticated;
```

## 3. Backend service — add to `post-service.ts`

Add result type next to `PublicPostListResult`:

```ts
export type ForYouPostListResult = PublicPostListResult;
export type FollowingPostListResult =
  | { status: "ok"; data: { posts: Record<string, unknown>[]; nextCursor: string | null } }
  | { status: "unauthenticated" }
  | { status: "unavailable" };
```

Add methods inside the returned service object:

```ts
    async listForYou(cursor: string | null, limit: number, tag?: string | null, postType?: string | null): Promise<ForYouPostListResult> {
      try {
        const { data, error } = await caller().rpc("list_for_you_posts", {
          p_cursor: cursor,
          p_limit: limit,
          p_tag: tag ?? null,
          p_post_type: postType ?? null,
        });
        if (error) return { status: "unavailable" };
        const row = data as { posts?: Record<string, unknown>[]; next_cursor?: string | null };
        return { status: "ok", data: { posts: row.posts ?? [], nextCursor: row.next_cursor ?? null } };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "listForYou", error });
        return { status: "unavailable" };
      }
    },

    async listFollowing(token: string, cursor: string | null, limit: number, tag?: string | null, postType?: string | null): Promise<FollowingPostListResult> {
      try {
        const { data, error } = await caller(token).rpc("list_following_posts", {
          p_cursor: cursor,
          p_limit: limit,
          p_tag: tag ?? null,
          p_post_type: postType ?? null,
        });
        if (error) {
          if ((error.code ?? "") === "42501" || (error.message ?? "").includes("UNAUTHENTICATED")) return { status: "unauthenticated" };
          return { status: "unavailable" };
        }
        const row = data as { posts?: Record<string, unknown>[]; next_cursor?: string | null };
        return { status: "ok", data: { posts: row.posts ?? [], nextCursor: row.next_cursor ?? null } };
      } catch (error) {
        logServiceError({ service: "post-service", operation: "listFollowing", error });
        return { status: "unavailable" };
      }
    },
```

## 4. Backend routes — add to `routes/posts.ts`

```ts
  // For You — algorithmic, per-user. Falls back to global feed for anon.
  app.get("/api/v1/posts/feed/for-you", { config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid post query parameters.");
    const q = parsed.data;
    // Authenticated -> algo feed; unauthenticated -> public feed fallback.
    if (request.auth?.accessToken) {
      const result = await options.postService.listForYou(q.cursor ?? null, q.limit ?? 20, q.tag ?? null, q.postType ?? null);
      if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Posts are temporarily unavailable.");
      return { posts: result.data.posts, nextCursor: result.data.nextCursor };
    }
    const result = await options.postService.listPublic(q.cursor ?? null, q.limit ?? 20, q.tag ?? null, q.postType ?? null, q.authorName ?? null, q.communityId ?? null);
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Posts are temporarily unavailable.");
    return { posts: result.data.posts, nextCursor: result.data.nextCursor };
  });

  // Following — requires auth (follow graph).
  app.get("/api/v1/posts/feed/following", { preHandler: app.authenticate, config: { rateLimit: { max: options.readMax, timeWindow: options.windowMs } }, onSend: noStore }, async (request) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError(400, "INVALID_QUERY", "Invalid post query parameters.");
    const q = parsed.data;
    const result = await options.postService.listFollowing(request.auth.accessToken, q.cursor ?? null, q.limit ?? 20, q.tag ?? null, q.postType ?? null);
    if (result.status === "unauthenticated") throw new ApiError(401, "UNAUTHENTICATED", "Authentication required to view your Following feed.");
    if (result.status !== "ok") throw new ApiError(503, "SERVICE_UNAVAILABLE", "Posts are temporarily unavailable.");
    return { posts: result.data.posts, nextCursor: result.data.nextCursor };
  });
```

Add `authorName` to `listQuerySchema` (it is missing today — needed so the public-fallback path can still honor it; harmless to keep).

## 5. Frontend — extend `posts-api.ts`

```ts
export async function listForYouPosts(params: { cursor?: string | null; limit?: number; tag?: string | null; postType?: string | null } = {}) {
  const q = new URLSearchParams();
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", String(params.limit));
  if (params.tag) q.set("tag", params.tag);
  if (params.postType) q.set("postType", params.postType);
  const qs = q.toString();
  return apiFetch<{ posts: Post[]; nextCursor: string | null }>(`/api/v1/posts/feed/for-you${qs ? `?${qs}` : ""}`, { auth: null });
}

export async function listFollowingPosts(params: { cursor?: string | null; limit?: number; tag?: string | null; postType?: string | null } = {}) {
  const q = new URLSearchParams();
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit) q.set("limit", params.limit);
  if (params.tag) q.set("tag", params.tag);
  if (params.postType) q.set("postType", params.postType);
  const qs = q.toString();
  return apiFetch<{ posts: Post[]; nextCursor: string | null }>(`/api/v1/posts/feed/following${qs ? `?${qs}` : ""}`);
}
```

> `apiFetch`'s third arg: `{ auth: false }` = public; omit = bearer token attached. Use `{ auth: null }` semantics exactly as `getPost`/`listPosts` do (no token) for the fallback path. Check `api.ts` if `auth: null`/`false` differs.

## 6. Frontend — branch fetch in `PostsTab` (`posts-page.tsx`)

Replace the body of `loadPostsReset` and `loadPosts` so the data source depends on `feedMode`:

```ts
  const fetcher = useCallback(async (cursor: string | null) => {
    const base = { cursor, limit: 20, tag: feedMode === "communities" ? searchQuery || null : null, postType: feedMode === "questions" ? "question" : null };
    if (feedMode === "following") return listFollowingPosts(base);
    if (feedMode === "for you") return listForYouPosts(base);
    return listPosts(base);
  }, [feedMode, searchQuery]);

  const loadPostsReset = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher(null);
      setPosts(result.posts);
      setCursor(result.nextCursor);
      setHasMore(result.nextCursor !== null);
    } catch {
      setError("Posts are temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  const loadPosts = useCallback(async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const result = await fetcher(cursor);
      setPosts(prev => [...prev, ...result.posts]);
      setCursor(result.nextCursor);
      setHasMore(result.nextCursor !== null);
    } catch {
      setError("Failed to load more posts.");
    } finally {
      setLoading(false);
    }
  }, [cursor, fetcher]);
```

Add distinct empty states:
- `following` empty → "Follow people to see their posts in your feed."
- `for you` empty → "No posts yet. Be the first to share something!" (current).

## 7. Tests — extend `test/posts.test.ts`

```ts
describe("posts feed personalization", () => {
  it("GET /api/v1/posts/feed/for-you is public (falls back, 200)", async () => {
    const { service } = { service: new FakeAuthService() };
    const app = createTestApp(service);
    const r = await app.inject({ method: "GET", url: "/api/v1/posts/feed/for-you" });
    expect(r.statusCode).toBe(200);
    expect(r.json().posts).toEqual([]);
  });

  it("GET /api/v1/posts/feed/following requires auth (401)", async () => {
    const app = createTestApp(new FakeAuthService());
    const r = await app.inject({ method: "GET", url: "/api/v1/posts/feed/following" });
    expect(r.statusCode).toBe(401);
  });
});
```

Also extend `fakePostService` with `listForYou` (ok) and `listFollowing` (ok) + wire `PostsTab` to use them (test asserts routing, not algo correctness).

-- 20260908000002_split_rls_policies.sql
-- Split `for all` RLS policies into per-command policies. The `for all`
-- pattern is convenient but makes future audits harder; per-command
-- policies make each surface's authz contract explicit and prevent
-- accidental privilege expansion if a new column becomes sensitive.
--
-- Tables affected:
--   - posts           (posts_author_write)
--   - comments        (comments_creator_write)
--   - post_reposts    (post_reposts_user_write)
--   - post_likes      (post_likes_user_write)
--   - comment_appreciations (comment_appreciations_user_write)
--   - follows         (follows_user_write)
--   - media_submissions (media_submissions_owner_write)
--
-- The `for select` policies are kept as-is. The `for all` policies are
-- dropped and replaced with per-command INSERT / UPDATE / DELETE policies
-- with the same using + with check expressions.
set search_path = '';

-- posts ────────────────────────────────────────────────────────────────
drop policy if exists posts_author_write on public.posts;
create policy posts_author_insert on public.posts
  for insert to authenticated
  with check (author_id = auth.uid());
create policy posts_author_update on public.posts
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
create policy posts_author_delete on public.posts
  for delete to authenticated
  using (author_id = auth.uid());

-- comments ────────────────────────────────────────────────────────────
drop policy if exists comments_creator_write on public.comments;
create policy comments_creator_insert on public.comments
  for insert to authenticated
  with check (creator_id = auth.uid());
create policy comments_creator_update on public.comments
  for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());
create policy comments_creator_delete on public.comments
  for delete to authenticated
  using (creator_id = auth.uid());

-- post_reposts ────────────────────────────────────────────────────────
drop policy if exists post_reposts_user_write on public.post_reposts;
create policy post_reposts_user_insert on public.post_reposts
  for insert to authenticated
  with check (user_id = auth.uid());
create policy post_reposts_user_delete on public.post_reposts
  for delete to authenticated
  using (user_id = auth.uid());

-- post_likes ──────────────────────────────────────────────────────────
drop policy if exists post_likes_user_write on public.post_likes;
create policy post_likes_user_insert on public.post_likes
  for insert to authenticated
  with check (user_id = auth.uid());
create policy post_likes_user_delete on public.post_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- comment_appreciations ───────────────────────────────────────────────
drop policy if exists comment_appreciations_user_write on public.comment_appreciations;
create policy comment_appreciations_user_insert on public.comment_appreciations
  for insert to authenticated
  with check (user_id = auth.uid());
create policy comment_appreciations_user_delete on public.comment_appreciations
  for delete to authenticated
  using (user_id = auth.uid());

-- follows ─────────────────────────────────────────────────────────────
-- `follows` has no UPDATE policy; the unique index (follower_id,
-- followee_id) blocks accidental "modify" attacks. Split the FOR ALL
-- into INSERT + DELETE.
drop policy if exists follows_user_write on public.follows;
create policy follows_user_insert on public.follows
  for insert to authenticated
  with check (follower_id = auth.uid());
create policy follows_user_delete on public.follows
  for delete to authenticated
  using (follower_id = auth.uid());

-- media_submissions (only if the table exists in this DB)
do $$ begin
  if exists (select 1 from pg_class where relname = 'media_submissions' and relnamespace = 'public'::regnamespace) then
    drop policy if exists media_submissions_owner_write on public.media_submissions;
    execute $sql$
      create policy media_submissions_owner_insert on public.media_submissions
        for insert to authenticated
        with check (owner_id = auth.uid())
    $sql$;
    execute $sql$
      create policy media_submissions_owner_update on public.media_submissions
        for update to authenticated
        using (owner_id = auth.uid())
        with check (owner_id = auth.uid())
    $sql$;
    execute $sql$
      create policy media_submissions_owner_delete on public.media_submissions
        for delete to authenticated
        using (owner_id = auth.uid())
    $sql$;
  end if;
end $$;

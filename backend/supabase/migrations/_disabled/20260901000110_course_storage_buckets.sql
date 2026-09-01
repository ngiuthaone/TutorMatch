-- 20260901000110_course_storage_buckets.sql
-- Creates storage buckets for course videos and downloadable resources.
set search_path = '';

-- course-videos bucket: private, 2GB limit, mp4/webm allowed
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-videos', 'course-videos', false, 2147483648, array['video/mp4', 'video/webm'])
on conflict (id) do nothing;

-- course-resources bucket: private, 100MB limit, pdf/docx/zip/image/text allowed
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-resources', 'course-resources', false, 104857600, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'])
on conflict (id) do nothing;

-- RLS policies for course-videos bucket
drop policy if exists course_videos_public_read on storage.objects;
create policy course_videos_public_read on storage.objects
  for select to authenticated
  using (bucket_id = 'course-videos');

drop policy if exists course_videos_auth_read on storage.objects;
create policy course_videos_auth_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'course-videos'
    and (
      -- Course creator can read their own course assets
      exists (
        select 1 from public.courses c
        join public.course_sections cs on cs.course_id = c.id
        join public.course_lessons cl on cl.section_id = cs.id
        where c.creator_id = auth.uid()
      )
      -- Enrolled learner can read course content
      or exists (
        select 1 from public.course_enrollments ce
        join public.courses c on c.id = ce.course_id
        join public.course_sections cs on cs.course_id = c.id
        join public.course_lessons cl on cl.section_id = cs.id
        where ce.user_id = auth.uid()
      )
    )
  );

drop policy if exists course_videos_creator_insert on storage.objects;
create policy course_videos_creator_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-videos'
    and exists (
      select 1 from public.courses c
      where c.creator_id = auth.uid()
    )
  );

drop policy if exists course_videos_creator_update on storage.objects;
create policy course_videos_creator_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'course-videos'
    and exists (
      select 1 from public.courses c
      where c.creator_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'course-videos'
    and exists (
      select 1 from public.courses c
      where c.creator_id = auth.uid()
    )
  );

drop policy if exists course_videos_creator_delete on storage.objects;
create policy course_videos_creator_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'course-videos'
    and exists (
      select 1 from public.courses c
      where c.creator_id = auth.uid()
    )
  );

-- RLS policies for course-resources bucket
drop policy if exists course_resources_public_read on storage.objects;
create policy course_resources_public_read on storage.objects
  for select to authenticated
  using (bucket_id = 'course-resources');

drop policy if exists course_resources_auth_read on storage.objects;
create policy course_resources_auth_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'course-resources'
    and (
      exists (
        select 1 from public.courses c
        join public.course_sections cs on cs.course_id = c.id
        join public.course_lessons cl on cl.section_id = cs.id
        where c.creator_id = auth.uid()
      )
      or exists (
        select 1 from public.course_enrollments ce
        join public.courses c on c.id = ce.course_id
        join public.course_sections cs on cs.course_id = c.id
        join public.course_lessons cl on cl.section_id = cs.id
        where ce.user_id = auth.uid()
      )
    )
  );

drop policy if exists course_resources_creator_insert on storage.objects;
create policy course_resources_creator_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-resources'
    and exists (
      select 1 from public.courses c
      where c.creator_id = auth.uid()
    )
  );

drop policy if exists course_resources_creator_update on storage.objects;
create policy course_resources_creator_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'course-resources'
    and exists (
      select 1 from public.courses c
      where c.creator_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'course-resources'
    and exists (
      select 1 from public.courses c
      where c.creator_id = auth.uid()
    )
  );

drop policy if exists course_resources_creator_delete on storage.objects;
create policy course_resources_creator_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'course-resources'
    and exists (
      select 1 from public.courses c
      where c.creator_id = auth.uid()
    )
  );

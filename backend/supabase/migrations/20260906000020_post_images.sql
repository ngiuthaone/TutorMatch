-- 20260906000020_post_images.sql
-- Add image support to posts and create storage bucket.
set search_path = '';

-- Add image_url column to posts
alter table public.posts add column if not exists image_url text;

-- Create storage bucket for post images (if using Supabase storage)
-- Note: This requires the storage schema to exist
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- RLS policies for post-images bucket
create policy "post_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'post-images');

create policy "post_images_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-images');

create policy "post_images_owner_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-images' and owner = auth.uid());

-- Create Supabase storage buckets for tutor profile media.
-- The 20260822000000_tutor_profile_media_and_full_fields migration added RLS
-- policies on storage.objects for these buckets, but the buckets themselves
-- were never provisioned. Without INSERT INTO storage.buckets, uploads 404.
set search_path = '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('intro-videos', 'intro-videos', false, 104857600, array['video/mp4','video/webm']),
  ('verification-docs', 'verification-docs', false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

-- 20260905000001_production_fixes.sql
-- Production readiness fixes: missing indexes, updated_at trigger, RLS policies

set search_path = '';

-- ─────────────────────────────────────────────────────────────────────
-- 1. Missing indexes
-- ─────────────────────────────────────────────────────────────────────

create index if not exists sessions_offering_id on public.sessions(offering_id);
create index if not exists marketplace_listings_creator on public.marketplace_listings(creator_id);
create index if not exists reschedule_requests_booking_status on public.reschedule_requests(booking_id, status);
create index if not exists profiles_role on public.profiles(role);

-- ─────────────────────────────────────────────────────────────────────
-- 2. marketplace_listings.updated_at BEFORE UPDATE trigger
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.set_marketplace_listing_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_marketplace_listings_updated_at on public.marketplace_listings;
create trigger trg_marketplace_listings_updated_at
  before update on public.marketplace_listings
  for each row execute function public.set_marketplace_listing_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 3. RLS policies for profiles INSERT/UPDATE
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke delete on public.profiles from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 4. is_tutor_published function
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.is_tutor_published(p_user_id uuid) returns boolean
language plpgsql security definer set search_path=''
as $$
begin
  return exists (
    select 1 from public.tutor_profiles tp
    where tp.user_id = p_user_id and tp.publication_status = 'published'
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. RLS policies for tutor_cv tables
-- ─────────────────────────────────────────────────────────────────────

-- tutor_profiles
drop policy if exists "tutor_profiles_public_read" on public.tutor_profiles;
create policy "tutor_profiles_public_read"
  on public.tutor_profiles for select
  using (public.is_tutor_published(tutor_profiles.user_id) = true or auth.uid() = tutor_profiles.user_id);

drop policy if exists "tutor_profiles_owner_insert" on public.tutor_profiles;
create policy "tutor_profiles_owner_insert"
  on public.tutor_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "tutor_profiles_owner_update" on public.tutor_profiles;
create policy "tutor_profiles_owner_update"
  on public.tutor_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- subjects and regions (seeded lookup tables)
drop policy if exists "subjects_read_all" on public.subjects;
create policy "subjects_read_all"
  on public.subjects for select using (true);

drop policy if exists "regions_read_all" on public.regions;
create policy "regions_read_all"
  on public.regions for select using (true);

-- tutor_subjects
drop policy if exists "tutor_subjects_read" on public.tutor_subjects;
create policy "tutor_subjects_read"
  on public.tutor_subjects for select
  using (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_subjects.tutor_profile_id
        and (tp.user_id = auth.uid() or public.is_tutor_published(tp.user_id) = true)
    )
  );

drop policy if exists "tutor_subjects_write" on public.tutor_subjects;
create policy "tutor_subjects_write"
  on public.tutor_subjects for insert
  with check (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_subjects.tutor_profile_id and tp.user_id = auth.uid()
    )
  );

-- tutor_levels
drop policy if exists "tutor_levels_read" on public.tutor_levels;
create policy "tutor_levels_read"
  on public.tutor_levels for select
  using (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_levels.tutor_profile_id
        and (tp.user_id = auth.uid() or public.is_tutor_published(tp.user_id) = true)
    )
  );

drop policy if exists "tutor_levels_write" on public.tutor_levels;
create policy "tutor_levels_write"
  on public.tutor_levels for insert
  with check (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_levels.tutor_profile_id and tp.user_id = auth.uid()
    )
  );

-- tutor_regions
drop policy if exists "tutor_regions_read" on public.tutor_regions;
create policy "tutor_regions_read"
  on public.tutor_regions for select
  using (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_regions.tutor_profile_id
        and (tp.user_id = auth.uid() or public.is_tutor_published(tp.user_id) = true)
    )
  );

drop policy if exists "tutor_regions_write" on public.tutor_regions;
create policy "tutor_regions_write"
  on public.tutor_regions for insert
  with check (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_regions.tutor_profile_id and tp.user_id = auth.uid()
    )
  );

-- tutor_languages
drop policy if exists "tutor_languages_read" on public.tutor_languages;
create policy "tutor_languages_read"
  on public.tutor_languages for select
  using (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_languages.tutor_profile_id
        and (tp.user_id = auth.uid() or public.is_tutor_published(tp.user_id) = true)
    )
  );

drop policy if exists "tutor_languages_write" on public.tutor_languages;
create policy "tutor_languages_write"
  on public.tutor_languages for insert
  with check (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_languages.tutor_profile_id and tp.user_id = auth.uid()
    )
  );

-- tutor_availability_slots
drop policy if exists "tutor_availability_slots_read" on public.tutor_availability_slots;
create policy "tutor_availability_slots_read"
  on public.tutor_availability_slots for select
  using (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_availability_slots.tutor_profile_id and tp.user_id = auth.uid()
    )
  );

drop policy if exists "tutor_availability_slots_write" on public.tutor_availability_slots;
create policy "tutor_availability_slots_write"
  on public.tutor_availability_slots for insert
  with check (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_availability_slots.tutor_profile_id and tp.user_id = auth.uid()
    )
  );

-- tutor_education_entries
drop policy if exists "tutor_education_entries_read" on public.tutor_education_entries;
create policy "tutor_education_entries_read"
  on public.tutor_education_entries for select
  using (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_education_entries.tutor_profile_id
        and (tp.user_id = auth.uid() or public.is_tutor_published(tp.user_id) = true)
    )
  );

drop policy if exists "tutor_education_entries_write" on public.tutor_education_entries;
create policy "tutor_education_entries_write"
  on public.tutor_education_entries for insert
  with check (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_education_entries.tutor_profile_id and tp.user_id = auth.uid()
    )
  );

-- tutor_experience_entries
drop policy if exists "tutor_experience_entries_read" on public.tutor_experience_entries;
create policy "tutor_experience_entries_read"
  on public.tutor_experience_entries for select
  using (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_experience_entries.tutor_profile_id
        and (tp.user_id = auth.uid() or public.is_tutor_published(tp.user_id) = true)
    )
  );

drop policy if exists "tutor_experience_entries_write" on public.tutor_experience_entries;
create policy "tutor_experience_entries_write"
  on public.tutor_experience_entries for insert
  with check (
    exists (
      select 1 from public.tutor_profiles tp
      where tp.id = tutor_experience_entries.tutor_profile_id and tp.user_id = auth.uid()
    )
  );

-- tutor_profile_events
drop policy if exists "tutor_profile_events_owner" on public.tutor_profile_events;
create policy "tutor_profile_events_owner"
  on public.tutor_profile_events for all
  using (auth.uid() = tutor_profile_events.actor_user_id)
  with check (auth.uid() = tutor_profile_events.actor_user_id);

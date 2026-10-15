set search_path = '';

-- Course creator parity columns
alter table public.courses
  add column if not exists subtitle text,
  add column if not exists language text not null default 'en' check (language in ('en', 'vi')),
  add column if not exists level text not null default 'all' check (level in ('beginner', 'intermediate', 'expert', 'all')),
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists topics text[] default '{}',
  add column if not exists promo_video_url text,
  add column if not exists promo_video_status text default 'none' check (promo_video_status in ('none', 'processing', 'ready', 'failed')),
  add column if not exists welcome_message text,
  add column if not exists completion_message text,
  add column if not exists intended_learners text,
  add column if not exists requirements text,
  add column if not exists what_you_will_learn text,
  add column if not exists who_is_this_for text,
  add column if not exists is_premium_instructor boolean not null default false,
  add column if not exists onboarding_step integer not null default 0,
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists test_video_url text,
  add column if not exists weekly_time_estimate text check (weekly_time_estimate in ('0-2h', '2-4h', '5+h', 'undecided')),
  add column if not exists is_practice_test boolean not null default false,
  add column if not exists review_status text default 'draft' check (review_status in ('draft', 'pending', 'approved', 'rejected')),
  add column if not exists review_submitted_at timestamptz,
  add column if not exists review_notes text,
  add column if not exists accessibility_captions_claimed boolean not null default false,
  add column if not exists accessibility_audio_claimed boolean not null default false,
  add column if not exists accessibility_materials_claimed boolean not null default false;

-- Indexes
create index if not exists courses_category_idx on public.courses(category);
create index if not exists courses_language_idx on public.courses(language);
create index if not exists courses_level_idx on public.courses(level);
create index if not exists courses_review_status_idx on public.courses(review_status);

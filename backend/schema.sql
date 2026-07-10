create type user_role as enum ('student', 'tutor', 'admin');
create type tutor_verification_status as enum ('pending_review', 'approved', 'rejected');
create type lesson_format as enum ('online', 'home', 'both');
create type request_status as enum ('open', 'closed');
create type case_status as enum (
  'pending',
  'negotiating',
  'confirmed',
  'awaiting_payment',
  'paid',
  'active',
  'completed',
  'cancelled'
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  name text not null,
  role user_role not null,
  phone text,
  address text,
  student_kind text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table tutor_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  subjects text[] not null default '{}',
  regions text[] not null default '{}',
  format lesson_format not null default 'both',
  hourly_rate integer not null default 0,
  age integer,
  education_level text,
  availability text[] not null default '{}',
  bio text,
  credential_files text[] not null default '{}',
  verification_status tutor_verification_status not null default 'pending_review',
  rejection_reason text,
  rating_avg numeric(3, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table student_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users(id) on delete cascade,
  subjects text[] not null default '{}',
  grade text not null,
  region text not null,
  format lesson_format not null,
  schedule text[] not null default '{}',
  budget_min integer not null default 0,
  budget_max integer not null default 0,
  students_count integer not null default 1,
  note text,
  status request_status not null default 'open',
  created_at timestamptz not null default now()
);

create table cases (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references student_requests(id) on delete cascade,
  tutor_id uuid not null references users(id) on delete cascade,
  status case_status not null default 'pending',
  cancelled_reason text,
  cancelled_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (request_id, tutor_id)
);

create table confirmation_letters (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references cases(id) on delete cascade,
  lessons_count integer not null,
  schedule text not null,
  fee integer not null,
  format lesson_format not null,
  note text,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  payer_id uuid not null references users(id) on delete cascade,
  amount integer not null,
  type text not null default 'connection_fee',
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  reviewer_id uuid not null references users(id) on delete cascade,
  reviewee_id uuid not null references users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (case_id, reviewer_id, reviewee_id)
);

create index idx_tutor_profiles_approved on tutor_profiles(verification_status);
create index idx_student_requests_open on student_requests(status);
create index idx_cases_request on cases(request_id);
create index idx_cases_tutor on cases(tutor_id);
create index idx_messages_case_time on messages(case_id, created_at);

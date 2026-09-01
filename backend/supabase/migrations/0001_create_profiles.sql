-- Tutoria authentication foundation. Safe to reapply during local development.
do $$ begin
  create type public.user_role as enum ('student', 'tutor', 'admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  name text not null,
  phone text null,
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_valid check (char_length(btrim(name)) between 1 and 120),
  constraint profiles_phone_valid check (phone is null or char_length(btrim(phone)) between 1 and 32),
  constraint profiles_avatar_url_valid check (avatar_url is null or char_length(btrim(avatar_url)) between 1 and 2048)
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
  safe_name text;
  safe_role public.user_role;
begin
  requested_name := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  if requested_name <> '' then
    safe_name := left(requested_name, 120);
  else
    safe_name := left(btrim(coalesce(split_part(new.email, '@', 1), '')), 120);
    if safe_name = '' then safe_name := 'New user'; end if;
  end if;
  -- SECURITY INVARIANT (L9): a new auth.users row's raw_user_meta_data
  -- is fully caller-controlled, so this trigger MUST NOT map any value to
  -- 'admin'. The CASE only ever returns 'tutor' or 'student', and any
  -- user-supplied 'role' outside that set falls through to 'student'.
  -- Promote to admin only via an explicit server-side RPC (e.g.
  -- promote_user_to_admin), never via signup metadata.
  safe_role := case new.raw_user_meta_data ->> 'role'
    when 'tutor' then 'tutor'::public.user_role
    when 'student' then 'student'::public.user_role
    else 'student'::public.user_role
  end;
  insert into public.profiles (id, role, name) values (new.id, safe_role, safe_name)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users for each row execute function public.handle_new_user_profile();

create or replace function public.set_profile_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function public.set_profile_updated_at() from public, anon, authenticated;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_profile_updated_at();

alter table public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);

revoke all privileges on table public.profiles from public;
revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

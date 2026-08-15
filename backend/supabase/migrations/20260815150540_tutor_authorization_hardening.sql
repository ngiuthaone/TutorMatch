-- Public signup metadata is user-controlled.  It may describe intent, but it
-- must never grant a privileged Tutor capability.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
  safe_name text;
begin
  requested_name := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  if requested_name <> '' then
    safe_name := left(requested_name, 120);
  else
    safe_name := left(btrim(coalesce(split_part(new.email, '@', 1), '')), 120);
    if safe_name = '' then safe_name := 'New user'; end if;
  end if;

  insert into public.profiles (id, role, name)
  values (new.id, 'student'::public.user_role, safe_name)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;

-- The only V1 role elevation path.  The service_role grant is intentionally
-- narrower than an authenticated grant; ordinary browsers cannot invoke it.
create or replace function public.enable_tutor(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users where id = target_user_id) then
    raise no_data_found;
  end if;
  update public.profiles
  set role = 'tutor'::public.user_role, updated_at = now()
  where id = target_user_id;
  if not found then raise no_data_found; end if;
  return true;
end;
$$;

revoke all on function public.enable_tutor(uuid) from public, anon, authenticated;
grant execute on function public.enable_tutor(uuid) to service_role;

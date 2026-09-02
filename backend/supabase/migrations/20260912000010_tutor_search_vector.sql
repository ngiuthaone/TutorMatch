-- Add a tsvector search column to tutor_profiles for full-text search.
-- The GIN index enables fast search across display_name, headline, and bio.
set search_path = '';

alter table public.tutor_profiles
  add column if not exists search_vector tsvector;

-- Compute the initial vector
update public.tutor_profiles
  set search_vector =
    setweight(to_tsvector('simple', coalesce(display_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(headline, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(bio, '')), 'C');

create index if not exists tutor_profiles_search_vector_idx
  on public.tutor_profiles using gin(search_vector);

-- Trigger: keep search_vector up to date on display_name/headline/bio changes
create or replace function public.tutor_profiles_set_search_vector() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.display_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.headline, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.bio, '')), 'C');
  return new;
end $$;
revoke all on function public.tutor_profiles_set_search_vector() from public, anon, authenticated;

drop trigger if exists tutor_profiles_search_vector_update on public.tutor_profiles;
create trigger tutor_profiles_search_vector_update
  before insert or update of display_name, headline, bio on public.tutor_profiles
  for each row execute function public.tutor_profiles_set_search_vector();

-- RPC: search published tutors by full-text query
create or replace function public.search_tutors(
  p_query text,
  p_limit int default 24
) returns setof public.tutor_profiles
language sql stable security definer set search_path = '' as $$
  select *
  from public.tutor_profiles
  where publication_status = 'published'
    and is_tutor_published(user_id)
    and (
      p_query is null or p_query = '' or
      search_vector @@ plainto_tsquery('simple', p_query)
    )
  order by
    case when p_query is null or p_query = '' then 0 else ts_rank(search_vector, plainto_tsquery('simple', p_query)) end desc,
    updated_at desc
  limit greatest(1, least(p_limit, 100));
$$;
revoke all on function public.search_tutors(text, int) from public, anon, authenticated;
grant execute on function public.search_tutors(text, int) to anon, authenticated;

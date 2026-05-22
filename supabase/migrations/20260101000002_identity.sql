-- forward
-- The `users` table mirrors Supabase auth.users at app-level so we can FK from
-- application tables without crossing the auth schema boundary.
-- Populated by a trigger on auth.users insert.

create table public.users (
  id              uuid primary key,
  email           citext unique,
  phone           text unique,
  apple_sub       text unique,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table public.profiles (
  user_id                     uuid primary key references public.users(id) on delete cascade,
  display_name                text not null,
  avatar_url                  text,
  birth_year                  int,
  birth_date                  date,
  tagline                     text,
  default_visibility_rule_id  uuid,
  notification_prefs          jsonb not null default '{}'::jsonb,
  text_size_scale             numeric(3,2) not null default 1.0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, phone)
  values (new.id, new.email, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- rollback
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.handle_new_auth_user();
-- drop table if exists public.profiles;
-- drop table if exists public.users;

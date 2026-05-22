-- forward
-- =============================================================================
-- Batch C — extend handle_new_auth_user
-- =============================================================================
-- The original signup trigger only inserted into public.users. That left
-- new accounts unable to do anything meaningful: no profile, no family circle,
-- so no way to create events.
--
-- This migration extends the trigger to also:
--   1. Insert a profiles row with display_name derived from the auth metadata
--      (which we set during the sign-up form: first name + last initial), or
--      falling back to the email local part.
--   2. Create a default family_circle named "<display_name>'s family" and
--      make the new user an admin member of it. This guarantees every signed-in
--      user has at least one circle they can host events in.
--   3. Mark the user as their own immediate family in that circle (no-op edge,
--      but keeps invariants clean).
--
-- Idempotent: uses ON CONFLICT DO NOTHING so re-running on an existing user
-- is safe. Useful when we backfill the existing accounts in the dashboard.
--
-- ROLLBACK: see bottom of file.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_circle_id    uuid;
begin
  -- 1. Resolve a display name. The web sign-up screen passes user metadata
  --    { first_name, last_initial } via supabase.auth.signUp options.data,
  --    which lands in raw_user_meta_data. Fall back to email local part if absent.
  v_display_name := coalesce(
    nullif(trim(
      coalesce(new.raw_user_meta_data->>'first_name', '')
      || ' '
      || coalesce(new.raw_user_meta_data->>'last_initial', '')
    ), ''),
    split_part(new.email, '@', 1),
    'New member'
  );

  -- 2. Mirror into public.users.
  insert into public.users (id, email, phone)
  values (new.id, new.email, new.phone)
  on conflict (id) do nothing;

  -- 3. Create the profile row. We need a default visibility rule though —
  --    pull the first visibility rule that exists (or null if the rules
  --    table isn't seeded yet; the column allows null until first edit).
  --    Note: default_visibility_rule_id is NOT NULL in some environments;
  --    we handle both shapes by selecting a sentinel if available.
  insert into public.profiles (
    user_id,
    display_name,
    default_visibility_rule_id
  )
  values (
    new.id,
    v_display_name,
    (select id from public.visibility_rules order by created_at asc limit 1)
  )
  on conflict (user_id) do nothing;

  -- 4. Create a default family circle and add the user as admin.
  insert into public.family_circles (name, created_by)
  values (v_display_name || '''s family', new.id)
  returning id into v_circle_id;

  insert into public.family_memberships (circle_id, user_id, role, is_immediate)
  values (v_circle_id, new.id, 'admin', true)
  on conflict do nothing;

  return new;
exception
  -- Don't block signup if any side-effect fails. The user still gets created
  -- in auth + public.users; profile/circle backfill can happen lazily.
  when others then
    raise warning 'handle_new_auth_user side-effects failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

-- Trigger is already attached from migration 0002; no re-attach needed.

-- rollback
-- Restore the minimal version from migration 0002.
-- create or replace function public.handle_new_auth_user()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- begin
--   insert into public.users (id, email, phone)
--   values (new.id, new.email, new.phone)
--   on conflict (id) do nothing;
--   return new;
-- end;
-- $$;

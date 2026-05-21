-- =============================================================================
-- pgTAP test setup — runs before every test file.
-- =============================================================================
-- Provisions the pgTAP extension and a small helper API for tests:
--   * tests.fixture_user(email, full_name)       → creates an auth.users row
--   * tests.fixture_circle(name, admin_uid)      → creates a family_circle + admin membership
--   * tests.fixture_member(circle, uid, role)    → adds a non-admin membership
--   * tests.set_role_authed(uid)                 → switches the session to that user's RLS context
--   * tests.reset_role()                         → back to postgres superuser
--
-- These exist so each test file is short, deterministic, and reads like a story
-- ("given these three users, given this circle, when X tries to do Y, expect Z").

-- pgTAP itself
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon, service_role;

-- ---- Fixture: a real auth.users row + matching public.users row -------------
create or replace function tests.fixture_user(p_email text, p_full_name text default 'Test')
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := uuid_generate_v4();
begin
  -- Mirror the auth schema's minimum required columns. Real signups go through
  -- Supabase Auth; for tests we insert directly.
  insert into auth.users (id, email, role, aud, instance_id, email_confirmed_at, created_at, updated_at)
  values (uid, p_email, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', now(), now(), now());

  insert into public.users (id, full_name, created_at)
  values (uid, p_full_name, now());

  return uid;
end;
$$;

-- ---- Fixture: family circle + admin membership ------------------------------
create or replace function tests.fixture_circle(p_name text, p_admin_uid uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid := uuid_generate_v4();
begin
  insert into public.family_circles (id, name, created_at)
  values (cid, p_name, now());

  insert into public.family_memberships (circle_id, user_id, role, joined_at)
  values (cid, p_admin_uid, 'admin', now());

  return cid;
end;
$$;

-- ---- Fixture: non-admin membership ------------------------------------------
create or replace function tests.fixture_member(p_circle uuid, p_uid uuid, p_role text default 'member')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_memberships (circle_id, user_id, role, joined_at)
  values (p_circle, p_uid, p_role, now())
  on conflict (circle_id, user_id) do nothing;
end;
$$;

-- ---- Helpers: switch session role to act as a specific user -----------------
-- We follow the Supabase test pattern: set the request.jwt.claim.sub local var
-- so auth.uid() returns the right thing, then SET ROLE to 'authenticated'.
create or replace function tests.set_role_authed(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create or replace function tests.reset_role()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

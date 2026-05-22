-- forward
-- =============================================================================
-- profiles.is_dev — admin/dev gate for in-app controls
-- =============================================================================
-- Adds a boolean flag to profiles that the mobile/web client reads via
-- `useIsDevUser()`. When true, the UI exposes admin-only affordances:
--  - "Reset demo (back to welcome)"
--  - Blended-family toggle
--  - Home-role toggle (child/asker vs parent/grandparent)
--
-- The client also honors a hardcoded email allowlist (aaron@skyway.media) so
-- the founder is never locked out before this migration deploys.
--
-- ROLLBACK: see bottom of file.

alter table public.profiles
  add column if not exists is_dev boolean not null default false;

comment on column public.profiles.is_dev is
  'When true, the FamLink client unlocks dev-only controls (reset demo, role toggle, blended-family demo). Set per-user as needed; defaults false.';

-- Seed Aaron's profile. Safe to re-run — the WHERE clause matches at most one
-- row, and we don't error if the user hasn't signed up yet.
update public.profiles
   set is_dev = true
 where user_id in (
   select id from public.users where email = 'aaron@skyway.media'
 );

-- rollback
-- alter table public.profiles drop column if exists is_dev;

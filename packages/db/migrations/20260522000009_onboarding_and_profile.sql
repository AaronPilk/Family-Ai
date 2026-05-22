-- forward
-- =============================================================================
-- Onboarding + profile-editing schema
-- =============================================================================
-- Adds two columns to public.profiles:
--   1. onboarding_completed — gates the onboarding flow on the client. The
--      handle_new_auth_user trigger inserts profiles with this defaulting to
--      false, so freshly-minted accounts route into /onboarding/welcome until
--      the final step flips it to true.
--   2. role — the user's generational role within their family:
--        'elder'  → parent/grandparent (the storyteller — sees Answer mode)
--        'child'  → adult child / grandchild (the asker — sees Ask mode)
--        'middle' → both: a parent who also still has living parents
--      Drives role-aware prompt selection in the Ask tab and the Home hero.
--
-- The client mirrors this into the existing zustand userRole, but the DB row
-- is the durable source of truth so the right Ask/Answer mode shows up on
-- every device the user signs into.
--
-- The tagline column already exists (migration 0002), so we don't add it again.
--
-- ROLLBACK: see bottom of file.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

alter table public.profiles
  add column if not exists role text
    check (role is null or role in ('elder', 'middle', 'child'));

comment on column public.profiles.onboarding_completed is
  'True once the user has finished the in-app onboarding (welcome + role + invite/skip). Until then the client routes to /onboarding/welcome on every cold start.';

comment on column public.profiles.role is
  'Generational role within the family: elder (parent/grandparent), child (adult child/grandchild), middle (both). Drives role-aware prompt selection. Nullable until the user picks during onboarding.';

-- rollback
-- alter table public.profiles drop column if exists role;
-- alter table public.profiles drop column if exists onboarding_completed;

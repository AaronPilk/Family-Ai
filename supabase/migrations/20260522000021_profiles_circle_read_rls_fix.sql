-- forward
-- =============================================================================
-- profiles_circle_read RLS fix — bypass users.deleted_at lookup via helper
-- =============================================================================
-- The hardened profiles_circle_read policy added in 20260101000012_rls_hardening
-- did two checks: (a) caller and target share an active circle, and (b) the
-- target's row in public.users has deleted_at IS NULL. The second check ran
-- as the calling user's role, so the EXISTS subquery was itself subject to
-- public.users RLS — which only allows users_self_read. Result: from any
-- non-postgres role, the inner EXISTS returned false for every target other
-- than auth.uid() itself, and the WHOLE profile read was silently blocked.
--
-- Symptom on prod (2026-05-22): the Family tab and family tree displayed
-- "Family member" / "FM" for everyone other than the signed-in user, because
-- the client's profile lookup returned zero rows. The email-username fallback
-- also failed for the same reason (users RLS again). Aaron couldn't read his
-- own brother's display_name even though the row was populated.
--
-- Fix: a SECURITY DEFINER helper public.user_is_active(uuid) bypasses RLS
-- specifically for the deleted_at existence check, returning a boolean that
-- the policy can call inline. The helper is restricted to authenticated +
-- service_role and does NOT expose any user fields — only a yes/no.
--
-- The new profiles_circle_read policy preserves both invariants:
--   - cross-circle isolation (caller + target must share an active circle)
--   - soft-delete hiding (deleted users' profiles stay invisible)
-- — but moves the deleted_at check through the helper.
--
-- This migration was first applied live to prod via the SQL editor while
-- debugging the Family tab. Codifying it here so db reset / fresh branches
-- pick it up.
--
-- ROLLBACK: drop the new policy and helper, then re-apply the original
-- profiles_circle_read policy from 20260101000012_rls_hardening.sql.

-- -----------------------------------------------------------------------------
-- 1. Helper: bypass RLS for the deleted_at lookup.
-- -----------------------------------------------------------------------------

create or replace function public.user_is_active(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = _user_id
      and deleted_at is null
  );
$$;

comment on function public.user_is_active(uuid) is
  'Returns true when the given user row exists and is not soft-deleted. SECURITY DEFINER so it bypasses public.users RLS, which only allows users_self_read. Used inside profiles_circle_read so the existence check works for circle co-members without leaking user fields.';

grant execute on function public.user_is_active(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Replace profiles_circle_read with the helper-based version.
-- -----------------------------------------------------------------------------

drop policy if exists profiles_circle_read on public.profiles;
create policy profiles_circle_read on public.profiles
  for select using (
    exists (
      select 1
      from public.family_memberships me
      join public.family_memberships them on me.circle_id = them.circle_id
      where me.user_id = auth.uid()
        and them.user_id = public.profiles.user_id
        and me.removed_at is null
        and them.removed_at is null
    )
    and public.user_is_active(public.profiles.user_id)
  );

-- rollback
-- drop policy if exists profiles_circle_read on public.profiles;
-- create policy profiles_circle_read on public.profiles
--   for select using (
--     exists (
--       select 1
--       from public.family_memberships me
--       join public.family_memberships them on me.circle_id = them.circle_id
--       where me.user_id = auth.uid()
--         and them.user_id = public.profiles.user_id
--         and me.removed_at is null
--         and them.removed_at is null
--     )
--     and exists (
--       select 1 from public.users u
--       where u.id = public.profiles.user_id and u.deleted_at is null
--     )
--   );
-- drop function if exists public.user_is_active(uuid);

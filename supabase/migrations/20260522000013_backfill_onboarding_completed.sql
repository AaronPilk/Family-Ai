-- forward
-- =============================================================================
-- Backfill onboarding_completed for legacy accounts
-- =============================================================================
-- Background: profiles.onboarding_completed was added in migration 000009 and
-- defaults to false. Any account created before then has it false, which makes
-- the root gate at app/index.tsx re-route the user to /onboarding/welcome on
-- every cold start — even though they're already fully signed up and using
-- the app.
--
-- Heuristic: if the profile has a non-empty display_name, the account was
-- "set up enough" to skip onboarding. (Brand-new signups going forward still
-- start with onboarding_completed = false and walk through the flow.)
--
-- Idempotent and safe to re-run.

update public.profiles
   set onboarding_completed = true
 where coalesce(onboarding_completed, false) = false
   and display_name is not null
   and length(trim(display_name)) > 0;

-- rollback (not generally useful, but documented):
-- update public.profiles set onboarding_completed = false where ...;

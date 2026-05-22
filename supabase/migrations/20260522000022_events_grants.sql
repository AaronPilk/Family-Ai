-- forward
-- =============================================================================
-- Restore DML grants on event tables for authenticated
-- =============================================================================
-- Migration 20260101000013_events.sql revoked insert/update/delete on every
-- event-related table from `authenticated` and `anon` as a defensive default,
-- with the intention that follow-up migrations (or SECURITY DEFINER RPCs)
-- would re-grant on a per-table basis.
--
-- Migration 20260522000003_events_rls_policies.sql added the RLS POLICIES
-- (events_insert, event_guests_insert, etc.) but never restored the GRANTs.
-- Postgres evaluates grants BEFORE RLS, so the policies were dead letter:
-- every INSERT/UPDATE/DELETE from a signed-in client got "permission denied
-- for table events" before RLS could even run its check.
--
-- Symptom on prod (2026-05-22): Aaron tapped "Create event" and got a
-- permission-denied error. This migration re-grants DML on the event tables
-- to authenticated. RLS policies (defined in 20260522000003) provide the
-- actual authorization — admins-only updates, host-only deletes, circle-
-- membership-required inserts, etc.
--
-- Granted to `authenticated` only; `anon` stays revoked (no signed-out user
-- should be writing event rows under any circumstance).
--
-- ROLLBACK: see bottom — restores the revokes from 20260101000013.

grant insert, update, delete on public.events             to authenticated;
grant insert, update, delete on public.event_circles      to authenticated;
grant insert, update, delete on public.event_guests       to authenticated;
grant insert, update, delete on public.event_bring_items  to authenticated;
grant insert, update, delete on public.event_polls        to authenticated;
grant insert, update, delete on public.event_poll_options to authenticated;
grant insert, update, delete on public.event_poll_votes   to authenticated;
grant insert, update, delete on public.event_messages     to authenticated;
grant insert, update, delete on public.event_media        to authenticated;
grant insert, update, delete on public.event_highlights   to authenticated;

-- rollback
-- revoke insert, update, delete on public.events             from authenticated;
-- revoke insert, update, delete on public.event_circles      from authenticated;
-- revoke insert, update, delete on public.event_guests       from authenticated;
-- revoke insert, update, delete on public.event_bring_items  from authenticated;
-- revoke insert, update, delete on public.event_polls        from authenticated;
-- revoke insert, update, delete on public.event_poll_options from authenticated;
-- revoke insert, update, delete on public.event_poll_votes   from authenticated;
-- revoke insert, update, delete on public.event_messages     from authenticated;
-- revoke insert, update, delete on public.event_media        from authenticated;
-- revoke insert, update, delete on public.event_highlights   from authenticated;

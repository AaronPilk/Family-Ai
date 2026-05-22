-- forward
-- =============================================================================
-- sms_invite_log — audit + rate-limit table for Twilio SMS invite sends
-- =============================================================================
-- Goal: every time a circle admin sends an SMS invite via the
-- `send_sms_invite` Edge Function, we record an attempt here. The function
-- queries this table to enforce a per-user rate limit (10 SMS / rolling hour)
-- and the client renders a "Recently sent" history below the invite UI.
--
-- The Edge Function uses the service-role key, so its INSERTs bypass RLS.
-- We still scope SELECT to the sender so users can only ever see their own
-- send history. Direct INSERTs from authenticated clients are forbidden.
--
-- Note: filename uses suffix `..._000007_` because `..._000006_` is already
-- taken by `profiles_is_dev.sql` in the supabase/migrations/ tree.
--
-- ROLLBACK: see bottom of file.

create table if not exists public.sms_invite_log (
  id              uuid primary key default gen_random_uuid(),
  sender_user_id  uuid not null references public.users(id) on delete cascade,
  circle_id       uuid not null references public.family_circles(id) on delete cascade,
  phone_e164      text not null,
  twilio_sid      text,
  status          text not null
                    check (status in ('queued', 'sent', 'failed'))
                    default 'queued',
  error           text,
  sent_at         timestamptz not null default now()
);

create index if not exists sms_invite_log_sender_idx
  on public.sms_invite_log (sender_user_id, sent_at desc);

comment on table public.sms_invite_log is
  'Audit log for Twilio SMS invite sends. Powers per-user rate-limiting and the "recently sent" UI.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.sms_invite_log enable row level security;

-- SELECT: senders see their own log only.
drop policy if exists sms_invite_log_select on public.sms_invite_log;
create policy sms_invite_log_select on public.sms_invite_log
  for select using (sender_user_id = auth.uid());

-- INSERT/UPDATE: no direct client access. The Edge Function writes via the
-- service role key, which bypasses RLS entirely. We deliberately omit any
-- INSERT/UPDATE policies so authenticated clients get a clean denial if they
-- ever try to fabricate a row.

-- rollback
-- drop policy if exists sms_invite_log_select on public.sms_invite_log;
-- drop index if exists public.sms_invite_log_sender_idx;
-- drop table if exists public.sms_invite_log;

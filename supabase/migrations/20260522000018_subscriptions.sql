-- forward
-- =============================================================================
-- Stripe subscriptions
-- =============================================================================
-- One Stripe Customer + one (optional) Subscription per FamLink user.
--
-- States we care about, in increasing order of "is paying":
--   none      — no subscription record exists (default).
--   f_and_f   — Friends & Family launch tier. Free forever (or until we end
--               that grace) and granted by the user tapping the F&F CTA on
--               /billing. Does NOT touch Stripe; the user has no customer or
--               subscription yet.
--   trialing  — Stripe says we're in a trial period (no current charge).
--   active    — Paying subscriber in good standing.
--   past_due  — A renewal payment failed; we keep access for a grace period
--               (Stripe's dunning) but the UI nudges them to update payment.
--   canceled  — Subscription ended (either user-initiated cancel + period end,
--               or hard cancel from dunning failure). No access if paywall is
--               on. We still keep stripe_customer_id around so they can come
--               back to the same Customer object.
--
-- Webhook → server-side flips: the stripe_webhook edge function is the only
-- thing that writes the paid-state columns. The mark_f_and_f() RPC writes the
-- f_and_f tier (which the webhook will never touch).
--
-- ROLLBACK: see bottom of file.

-- -----------------------------------------------------------------------------
-- 1. Add the subscription columns to profiles.
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists stripe_customer_id              text,
  add column if not exists stripe_subscription_id          text,
  add column if not exists subscription_status             text not null default 'none',
  add column if not exists subscription_tier               text not null default 'none',
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_marked_at          timestamptz;

-- Unique index on the Stripe Customer id so we can look the row up from the
-- webhook by `cus_xxx` alone. Partial index so we don't reject the dozens of
-- profiles with a null value (the default).
create unique index if not exists profiles_stripe_customer_id_uidx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Constrain status to the small enum we actually use. text + check is friendlier
-- than a real enum here because Stripe occasionally invents new status values
-- (e.g. 'paused') and a text column lets us land a hotfix without a migration.
alter table public.profiles
  drop constraint if exists profiles_subscription_status_chk;
alter table public.profiles
  add constraint profiles_subscription_status_chk
  check (subscription_status in ('none','f_and_f','trialing','active','past_due','canceled'));

comment on column public.profiles.stripe_customer_id is
  'Stripe Customer object id (cus_xxx). Null until first checkout or F&F activation.';
comment on column public.profiles.stripe_subscription_id is
  'Stripe Subscription object id (sub_xxx). Null for f_and_f and none.';
comment on column public.profiles.subscription_status is
  'One of: none, f_and_f, trialing, active, past_due, canceled. Webhook is the only writer for paid statuses; mark_f_and_f() is the only writer for f_and_f.';
comment on column public.profiles.subscription_tier is
  'Denormalized human-facing tier name for the UI. e.g. "Friends & Family", "Annual".';
comment on column public.profiles.subscription_current_period_end is
  'When the current paid period ends. Null for f_and_f and none.';
comment on column public.profiles.subscription_marked_at is
  'When subscription_status last changed.';

-- RLS note: profiles already has a "users can SELECT their own profile" policy
-- (see 20260101000011_rls_policies.sql). The new columns inherit it. We do NOT
-- grant UPDATE on these columns to authenticated; clients flip status only via
-- the mark_f_and_f() RPC (security definer) or via the webhook (service role).

-- -----------------------------------------------------------------------------
-- 2. stripe_webhook_events — idempotency log for incoming webhooks.
-- -----------------------------------------------------------------------------
-- Stripe retries webhook deliveries on 5xx responses. Each event has a stable
-- event.id; we record it the first time we successfully process the event and
-- skip duplicates on retry. Payload kept for debugging/replay (Stripe events
-- are not PII-heavy by default — they're billing metadata).

create table if not exists public.stripe_webhook_events (
  id            uuid primary key default gen_random_uuid(),
  event_id      text not null unique,
  type          text not null,
  payload       jsonb not null,
  processed_at  timestamptz not null default now()
);

comment on table public.stripe_webhook_events is
  'One row per Stripe webhook event we have processed. Idempotency key is event_id.';

alter table public.stripe_webhook_events enable row level security;

-- No client-facing policy. The webhook edge function uses the service-role key
-- (RLS bypass) to read/write this table; nobody else needs to touch it.

-- -----------------------------------------------------------------------------
-- 3. mark_f_and_f() — RPC that records the calling user as Friends & Family.
-- -----------------------------------------------------------------------------
-- Idempotent. Returns true if it set (or kept) the row at f_and_f, false if it
-- refused to downgrade an existing paying user.

create or replace function public.mark_f_and_f()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current text;
begin
  if v_user_id is null then
    raise exception 'mark_f_and_f: not authenticated';
  end if;

  select subscription_status into v_current
    from public.profiles
   where user_id = v_user_id;

  if v_current is null then
    -- Profile row missing (rare; signup trigger should have created it). Insert
    -- a minimal row so the flag has somewhere to live. We deliberately do NOT
    -- try to invent a display_name here; the profile editor will fill it in.
    insert into public.profiles (user_id, display_name, subscription_status, subscription_tier, subscription_marked_at)
    values (v_user_id, '', 'f_and_f', 'Friends & Family', now())
    on conflict (user_id) do nothing;
    return true;
  end if;

  if v_current = 'f_and_f' then
    -- No-op: already in F&F. Don't bump subscription_marked_at — the original
    -- mark is the meaningful timestamp.
    return true;
  end if;

  if v_current in ('active','trialing') then
    -- Paying user — never silently downgrade. Surface as notice so callers can
    -- see why their RPC returned false.
    raise notice 'mark_f_and_f: user % is already %, refusing to switch to f_and_f', v_user_id, v_current;
    return false;
  end if;

  -- past_due / canceled / none — fine to move to f_and_f.
  update public.profiles
     set subscription_status   = 'f_and_f',
         subscription_tier     = 'Friends & Family',
         subscription_marked_at = now()
   where user_id = v_user_id;

  return true;
end;
$$;

grant execute on function public.mark_f_and_f() to authenticated;

comment on function public.mark_f_and_f() is
  'Sets the calling user to subscription_status=f_and_f. Idempotent. Will not downgrade an active/trialing paying user.';

-- rollback
-- drop function if exists public.mark_f_and_f();
-- drop table if exists public.stripe_webhook_events;
-- alter table public.profiles drop constraint if exists profiles_subscription_status_chk;
-- drop index if exists profiles_stripe_customer_id_uidx;
-- alter table public.profiles
--   drop column if exists stripe_customer_id,
--   drop column if exists stripe_subscription_id,
--   drop column if exists subscription_status,
--   drop column if exists subscription_tier,
--   drop column if exists subscription_current_period_end,
--   drop column if exists subscription_marked_at;

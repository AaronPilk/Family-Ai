-- forward
-- =============================================================================
-- Push subscriptions — one row per browser/installed-PWA per user
-- =============================================================================
-- Web push (RFC 8030) requires us to remember the endpoint + crypto material
-- the user agent handed us at subscribe time. We store one row per
-- (user, browser) pair. Multiple rows per user is normal — desktop Chrome,
-- iPhone PWA, iPad PWA each get their own row.
--
-- We key uniqueness on `endpoint` because the push service URL itself is a
-- unique browser-credential pair; if the same browser re-subscribes, the
-- endpoint is the same and we just update p256dh/auth/last_used_at via
-- ON CONFLICT.
--
-- The send_push edge function reads rows with SERVICE_ROLE (RLS bypass) to
-- fan out a notification to a user's devices. From the client side, users
-- only see their own rows.
--
-- ROLLBACK: see bottom of file.

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

comment on table public.push_subscriptions is
  'Web push (RFC 8030) subscription records. One row per (user, browser/PWA). Endpoint is unique across the table because the push service URL embeds browser credentials.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
-- A user can read, insert, update, and delete only their own subscriptions.
-- The send_push edge function uses the service-role key to bypass RLS when
-- fanning out a push.

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_self on public.push_subscriptions;
create policy push_subscriptions_self on public.push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- rollback
-- drop policy if exists push_subscriptions_self on public.push_subscriptions;
-- drop index if exists push_subscriptions_user_idx;
-- drop table if exists public.push_subscriptions;

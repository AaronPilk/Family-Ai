-- forward
-- =============================================================================
-- Batch C — event_messages
-- =============================================================================
-- Chat lives inside each event. Until now, messages have been mocked client-side
-- in mockData.ts (FamilyEvent.activity[]). This migration introduces the real
-- table so the July reunion test can use actual persisted chat.
--
-- One row per message. RLS gates read/write on event guest membership:
-- a user can read a message only if they're a guest of that event, and they
-- can insert messages only on behalf of themselves (author_user_id = auth.uid).
--
-- Subscribe in the client via Supabase Realtime postgres_changes on inserts.
--
-- ROLLBACK: see bottom of file.

-- -----------------------------------------------------------------------------
-- 1. event_messages
-- -----------------------------------------------------------------------------

create table if not exists public.event_messages (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  author_user_id  uuid not null references public.users(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index event_messages_event_created_idx
  on public.event_messages (event_id, created_at desc);

create index event_messages_author_idx
  on public.event_messages (author_user_id);

comment on table public.event_messages is
  'Chat messages scoped to a single event. Read/write restricted to event guests via RLS.';

-- -----------------------------------------------------------------------------
-- 2. RLS — only event guests can read; only the author can insert as themselves
-- -----------------------------------------------------------------------------

alter table public.event_messages enable row level security;

-- READ: a row is visible if the requester is a guest of the same event.
-- We resolve the requester (auth.uid) → public.users.id and check event_guests.
drop policy if exists event_messages_read on public.event_messages;
create policy event_messages_read on public.event_messages
  for select
  using (
    exists (
      select 1
      from public.event_guests g
      where g.event_id = event_messages.event_id
        and g.user_id = auth.uid()
    )
    -- The host can always read.
    or exists (
      select 1
      from public.events e
      where e.id = event_messages.event_id
        and e.host_user_id = auth.uid()
    )
  );

-- INSERT: caller must be authenticated, the author_user_id must equal auth.uid,
-- and the caller must be a guest of that event (or the host).
drop policy if exists event_messages_insert on public.event_messages;
create policy event_messages_insert on public.event_messages
  for insert
  with check (
    author_user_id = auth.uid()
    and (
      exists (
        select 1
        from public.event_guests g
        where g.event_id = event_messages.event_id
          and g.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.events e
        where e.id = event_messages.event_id
          and e.host_user_id = auth.uid()
      )
    )
  );

-- UPDATE/DELETE: only the author may soft-delete their own messages.
-- We use UPDATE rather than DELETE so we keep an audit trail.
drop policy if exists event_messages_update_own on public.event_messages;
create policy event_messages_update_own on public.event_messages
  for update
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. Realtime — publish inserts to subscribers
-- -----------------------------------------------------------------------------
-- Supabase Realtime needs the table added to the supabase_realtime publication.

alter publication supabase_realtime add table public.event_messages;

-- rollback
-- alter publication supabase_realtime drop table public.event_messages;
-- drop policy if exists event_messages_update_own on public.event_messages;
-- drop policy if exists event_messages_insert on public.event_messages;
-- drop policy if exists event_messages_read on public.event_messages;
-- drop table if exists public.event_messages;

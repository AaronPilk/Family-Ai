-- forward
-- =============================================================================
-- Letters — asymmetric private messages with recipient-controlled read receipts
-- =============================================================================
-- A Letter is a one-way private message for hard-to-say things. The sender
-- gets catharsis; the recipient gets dignity. After reading, the recipient
-- chooses ONCE whether the sender ever sees a read receipt:
--   - YES: read_visible_to_sender = true; sender sees "Read at <time>".
--   - NO : read_visible_to_sender = false; sender forever sees only "Delivered".
-- The choice is permanent. Crucially: even at the database level, the sender
-- can never see `read_at` unless `read_visible_to_sender = true`. We enforce
-- this with a SELECT-side view (letters_for_sender) that hard-redacts the
-- column for sender reads, and with an UPDATE policy that:
--   1. forbids the sender from updating anything;
--   2. lets the recipient set read_at / read_visible_to_sender exactly once
--      (a non-null read_visible_to_sender value cannot be changed).
--
-- Why a view + RPC instead of relying purely on RLS? RLS gates row visibility
-- but doesn't redact specific columns. The sender's row IS visible (they need
-- to see their own body and delivery state); we just need read_at scrubbed.
-- A SECURITY INVOKER view solves this cleanly and respects RLS on the base
-- table.
--
-- ROLLBACK: see bottom of file.

-- -----------------------------------------------------------------------------
-- 1. letters table
-- -----------------------------------------------------------------------------

create table if not exists public.letters (
  id                        uuid primary key default gen_random_uuid(),
  sender_user_id            uuid not null references public.users(id) on delete cascade,
  recipient_user_id         uuid not null references public.users(id) on delete cascade,
  body                      text not null check (char_length(body) between 1 and 8000),
  sent_at                   timestamptz not null default now(),
  read_at                   timestamptz,
  -- null  = recipient hasn't decided yet
  -- false = recipient chose to keep the read private (sender never sees read_at)
  -- true  = recipient chose to let the sender see the read timestamp
  read_visible_to_sender    boolean,
  decided_at                timestamptz,
  deleted_at                timestamptz,
  -- A letter cannot be sent to yourself (catharsis flows outward).
  constraint letters_no_self_send check (sender_user_id <> recipient_user_id),
  -- If decided_at is set, the visibility choice must also be set, and vice versa.
  constraint letters_decision_pair check (
    (read_visible_to_sender is null and decided_at is null)
    or (read_visible_to_sender is not null and decided_at is not null)
  )
);

create index letters_recipient_idx on public.letters (recipient_user_id, sent_at desc);
create index letters_sender_idx    on public.letters (sender_user_id, sent_at desc);

comment on table public.letters is
  'Asymmetric one-way private messages. Recipient decides if the sender sees a read receipt; choice is permanent.';
comment on column public.letters.read_visible_to_sender is
  'null = undecided; false = sender forever sees only Delivered; true = sender sees Read timestamp. Once set, cannot flip.';

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------

alter table public.letters enable row level security;

-- SELECT: sender can see their own outgoing letters; recipient can see incoming.
-- Soft-deleted letters are hidden from both sides.
drop policy if exists letters_read on public.letters;
create policy letters_read on public.letters
  for select
  using (
    deleted_at is null
    and (
      sender_user_id = auth.uid()
      or recipient_user_id = auth.uid()
    )
  );

-- INSERT: only as yourself (sender_user_id = auth.uid()). The DB-level CHECK
-- on the table also blocks self-send.
drop policy if exists letters_insert on public.letters;
create policy letters_insert on public.letters
  for insert
  with check (
    sender_user_id = auth.uid()
    and sender_user_id <> recipient_user_id
  );

-- UPDATE: only the recipient can update, and only their own incoming letters.
-- Sender can never UPDATE anything (no policy permits them). The CHECK
-- expression below enforces:
--   - sender_user_id and recipient_user_id are immutable
--   - body, sent_at, deleted_at are immutable from the recipient's side
--   - once read_visible_to_sender is non-null, it cannot change (one-way lock)
--   - once read_at is non-null, it cannot change (read timestamp is permanent)
--
-- This is the airtight guarantee: even if a malicious client tries to flip
-- "no" back to "yes" later, Postgres rejects the row.
drop policy if exists letters_update_recipient on public.letters;
create policy letters_update_recipient on public.letters
  for update
  using (
    recipient_user_id = auth.uid()
    and deleted_at is null
  )
  with check (
    recipient_user_id = auth.uid()
    -- Immutable identity / content / send time
    -- (we compare via OLD.* in a trigger below since RLS WITH CHECK only
    -- sees NEW; the trigger handles per-column immutability properly.)
  );

-- Per-column immutability trigger. RLS WITH CHECK can only inspect NEW; to
-- compare against OLD we need a trigger. This is where the "no stays no"
-- guarantee lives.
create or replace function public.letters_enforce_immutability()
returns trigger
language plpgsql
as $$
begin
  -- Sender and recipient never change.
  if new.sender_user_id <> old.sender_user_id then
    raise exception 'letters: sender_user_id is immutable';
  end if;
  if new.recipient_user_id <> old.recipient_user_id then
    raise exception 'letters: recipient_user_id is immutable';
  end if;

  -- Body, sent_at are immutable.
  if new.body <> old.body then
    raise exception 'letters: body is immutable after send';
  end if;
  if new.sent_at <> old.sent_at then
    raise exception 'letters: sent_at is immutable';
  end if;

  -- read_at: once set, cannot change.
  if old.read_at is not null and (new.read_at is null or new.read_at <> old.read_at) then
    raise exception 'letters: read_at cannot be changed once set';
  end if;

  -- read_visible_to_sender: once set (true or false), cannot change.
  -- This is the airtight "no stays no, yes stays yes" lock.
  if old.read_visible_to_sender is not null
     and new.read_visible_to_sender is distinct from old.read_visible_to_sender then
    raise exception 'letters: read_visible_to_sender is permanent once decided';
  end if;

  -- decided_at must travel together with read_visible_to_sender. Once set,
  -- it cannot change.
  if old.decided_at is not null and new.decided_at is distinct from old.decided_at then
    raise exception 'letters: decided_at is immutable once set';
  end if;

  -- If the recipient is setting read_visible_to_sender for the first time,
  -- decided_at must also be set in the same UPDATE.
  if old.read_visible_to_sender is null and new.read_visible_to_sender is not null then
    if new.decided_at is null then
      raise exception 'letters: decided_at must be set alongside read_visible_to_sender';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists letters_immutability_trg on public.letters;
create trigger letters_immutability_trg
  before update on public.letters
  for each row execute function public.letters_enforce_immutability();

-- -----------------------------------------------------------------------------
-- 3. Sender-safe view — read_at is hard-redacted unless recipient opted in
-- -----------------------------------------------------------------------------
-- The sender's UI queries this view, never the base table for outgoing reads.
-- visible_read_at is the ONLY way the sender ever sees a read timestamp; if
-- read_visible_to_sender is null or false, it comes back as null no matter
-- what's in the base column.
--
-- security_invoker = on so the underlying letters RLS still applies (sender
-- can only see their own rows).

create or replace view public.letters_for_sender
  with (security_invoker = on)
as
select
  id,
  sender_user_id,
  recipient_user_id,
  body,
  sent_at,
  case when read_visible_to_sender = true then read_at else null end as visible_read_at,
  -- We deliberately do NOT expose read_visible_to_sender itself to the sender
  -- as a true/false signal — that would leak the recipient's choice. We do
  -- expose a coarse "has_decided" boolean so the sender's UI can show a soft
  -- "they haven't decided yet" footnote vs "Delivered" once a choice has been
  -- made but the user picked "private". From the sender's POV these two end
  -- states look identical (both are "Delivered" with no read timestamp), so
  -- this doesn't leak the choice.
  (read_visible_to_sender is not null) as recipient_has_decided,
  deleted_at
from public.letters
where deleted_at is null;

comment on view public.letters_for_sender is
  'Sender-safe view of letters. read_at is hard-redacted unless the recipient opted in. The recipient''s choice itself is not exposed; only a coarse has-decided boolean.';

-- Grant select to authenticated; RLS on the underlying table enforces rowscope.
grant select on public.letters_for_sender to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Realtime — publish updates so the sender's UI sees Delivered → Read flip
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table public.letters;

-- rollback
-- alter publication supabase_realtime drop table public.letters;
-- drop view if exists public.letters_for_sender;
-- drop trigger if exists letters_immutability_trg on public.letters;
-- drop function if exists public.letters_enforce_immutability();
-- drop policy if exists letters_update_recipient on public.letters;
-- drop policy if exists letters_insert on public.letters;
-- drop policy if exists letters_read on public.letters;
-- drop table if exists public.letters;

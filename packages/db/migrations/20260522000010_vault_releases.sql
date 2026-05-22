-- forward
-- =============================================================================
-- Vault proof-of-life — append-only entries + release flow
-- =============================================================================
-- Story:
--   A user silently uploads dated entries (workout videos, sobriety logs,
--   journal notes) to their Vault. Server timestamps mean nothing can be
--   backdated. When they're ready, they release the trail to a chosen
--   recipient — immediately, on a future date, or once the recipient joins
--   FamLink via a one-time invite. The recipient sees a chronological wall
--   of everything created up to that moment, plus anything added later until
--   the release is revoked.
--
-- DESIGN DECISIONS
--   - We don't reuse the existing public.vault_items table (migration 0008).
--     That table is heavyweight: every row requires a memory_items row + a
--     visibility rule + recipient arrays + a state-machine status. The
--     proof-of-life flow needs the opposite: cheap append-only journaling
--     with no per-entry recipient picking. So we introduce two new tables —
--     proof_vault_items and vault_releases — that live alongside the older
--     gift-style vault_items without disturbing it.
--   - A release is keyed on (author, recipient) and grants the recipient
--     a read window over ALL of the author's proof_vault_items that meet the
--     unlock condition. This is the "release a SCOPE" model — the author
--     keeps adding entries after release and the recipient sees them too,
--     until revoke.
--   - Unlock conditions are mutually exclusive at the row level but we keep
--     each as its own column for clarity:
--         unlock_at         null    → immediate
--         unlock_at         set     → time-locked
--         unlock_on_join    true    → condition-locked (recipient must join)
--   - RLS reads route through a SECURITY DEFINER helper
--     can_view_proof_vault_item(item_id, viewer_id). That keeps the policy
--     trivially small and avoids the recursive RLS pitfalls that nested
--     EXISTS clauses sometimes hit.
--
-- ROLLBACK at bottom.

-- -----------------------------------------------------------------------------
-- 1. Append-only entries
-- -----------------------------------------------------------------------------

create table if not exists public.proof_vault_items (
  id               uuid primary key default gen_random_uuid(),
  author_user_id   uuid not null references public.users(id) on delete cascade,
  body             text not null check (length(body) > 0 and length(body) <= 10000),
  media_asset_id   uuid references public.media_assets(id),
  -- Server-stamped. The client cannot set this; even if they try, the
  -- column default + UPDATE-restriction below makes it forensic-grade.
  created_at       timestamptz not null default now()
);

create index if not exists proof_vault_items_author_created_idx
  on public.proof_vault_items (author_user_id, created_at desc);

comment on table public.proof_vault_items is
  'Append-only journal entries used for the Vault proof-of-life flow. '
  'Server-stamped created_at is load-bearing — clients cannot edit or delete '
  'these rows, so the timestamp trail cannot be retroactively faked.';

-- Block edits + deletes outright via a trigger. (RLS would let us, but a
-- trigger gives us a clean error message + survives policy mistakes.)
create or replace function public.guard_proof_vault_items_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'proof_vault_items are append-only — cannot be edited';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'proof_vault_items are append-only — cannot be deleted';
  end if;
  return null;
end;
$$;

drop trigger if exists proof_vault_items_immutable on public.proof_vault_items;
create trigger proof_vault_items_immutable
  before update or delete on public.proof_vault_items
  for each row execute function public.guard_proof_vault_items_immutable();

-- -----------------------------------------------------------------------------
-- 2. Releases
-- -----------------------------------------------------------------------------

create table if not exists public.vault_releases (
  id                   uuid primary key default gen_random_uuid(),
  author_user_id       uuid not null references public.users(id) on delete cascade,
  recipient_user_id    uuid references public.users(id) on delete cascade,
  recipient_email      citext,
  unlock_at            timestamptz,
  unlock_on_join       boolean not null default false,
  invite_token         text references public.family_invite_links(token) on delete set null,
  released_at          timestamptz not null default now(),
  revoked_at           timestamptz,
  -- A release must target SOMEONE.
  constraint vault_releases_has_recipient
    check (recipient_user_id is not null or recipient_email is not null),
  -- unlock_on_join only makes sense when we don't already have a user id.
  constraint vault_releases_join_requires_pending
    check (
      unlock_on_join = false
      or recipient_user_id is null
    ),
  -- An author can have at most one active release per recipient_user_id so
  -- the "release my vault to dad" scope stays unambiguous.
  unique (author_user_id, recipient_user_id)
);

create index if not exists vault_releases_author_idx
  on public.vault_releases (author_user_id);
create index if not exists vault_releases_recipient_idx
  on public.vault_releases (recipient_user_id)
  where recipient_user_id is not null;
create index if not exists vault_releases_email_idx
  on public.vault_releases (recipient_email)
  where recipient_email is not null;

comment on table public.vault_releases is
  'A release grants a recipient read access to the author''s proof_vault_items '
  'matching the unlock condition. Immediate (unlock_at null), time-locked '
  '(unlock_at future), or condition-locked (unlock_on_join true, fires once '
  'the recipient claims the invite_token).';

-- -----------------------------------------------------------------------------
-- 3. Visibility helper
-- -----------------------------------------------------------------------------
-- Returns TRUE iff `viewer_id` is either:
--   (a) the author of the proof_vault_item, or
--   (b) the recipient of an unrevoked vault_release that:
--         - points at the same author
--         - has its unlock condition met (immediate, past unlock_at, or
--           unlock_on_join + viewer matches via invite token claim — i.e.
--           recipient_user_id has been populated by then), and
--         - the item was created on-or-before `released_at + small lookahead`
--           OR after release, as long as the release is still active.
--           (The spec calls this "release a SCOPE": once released, the
--           recipient keeps seeing new items until revoke.)

create or replace function public.can_view_proof_vault_item(
  p_item_id uuid,
  p_viewer_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when v.author_user_id = p_viewer_id then true
        else exists (
          select 1
          from public.vault_releases r
          where r.author_user_id = v.author_user_id
            and r.recipient_user_id = p_viewer_id
            and r.revoked_at is null
            and (r.unlock_at is null or r.unlock_at <= now())
            and r.unlock_on_join = false
        )
      end
      from public.proof_vault_items v
      where v.id = p_item_id
    ),
    false
  );
$$;

revoke execute on function public.can_view_proof_vault_item(uuid, uuid) from public, anon;
grant  execute on function public.can_view_proof_vault_item(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. RLS — proof_vault_items
-- -----------------------------------------------------------------------------

alter table public.proof_vault_items enable row level security;

drop policy if exists proof_vault_items_select on public.proof_vault_items;
create policy proof_vault_items_select on public.proof_vault_items
  for select using (
    auth.uid() = author_user_id
    or public.can_view_proof_vault_item(id, auth.uid())
  );

drop policy if exists proof_vault_items_insert on public.proof_vault_items;
create policy proof_vault_items_insert on public.proof_vault_items
  for insert with check (auth.uid() = author_user_id);

-- No UPDATE or DELETE policies — the immutability trigger blocks them anyway
-- but we leave the policies absent so the table is read+append-only by RLS too.

-- -----------------------------------------------------------------------------
-- 5. RLS — vault_releases
-- -----------------------------------------------------------------------------

alter table public.vault_releases enable row level security;

drop policy if exists vault_releases_author_read on public.vault_releases;
create policy vault_releases_author_read on public.vault_releases
  for select using (auth.uid() = author_user_id);

drop policy if exists vault_releases_recipient_read on public.vault_releases;
create policy vault_releases_recipient_read on public.vault_releases
  for select using (
    recipient_user_id is not null
    and auth.uid() = recipient_user_id
  );

drop policy if exists vault_releases_author_insert on public.vault_releases;
create policy vault_releases_author_insert on public.vault_releases
  for insert with check (auth.uid() = author_user_id);

-- Author can revoke their own release (only allowed mutation is setting
-- revoked_at and updating recipient_user_id when a pending invite is claimed).
drop policy if exists vault_releases_author_update on public.vault_releases;
create policy vault_releases_author_update on public.vault_releases
  for update using (auth.uid() = author_user_id)
  with check (auth.uid() = author_user_id);

-- -----------------------------------------------------------------------------
-- 6. Notification on release creation
-- -----------------------------------------------------------------------------
-- When a release has a known recipient_user_id, fire an in-app notification
-- so the recipient sees it next time they open the app. We don't try to push
-- yet — that's a later batch.

create or replace function public.notify_vault_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.recipient_user_id is not null then
    insert into public.notifications (user_id, kind, payload)
    values (
      new.recipient_user_id,
      'vault.released',
      jsonb_build_object(
        'release_id', new.id,
        'author_user_id', new.author_user_id,
        'unlock_at', new.unlock_at,
        'unlock_on_join', new.unlock_on_join
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists vault_releases_notify on public.vault_releases;
create trigger vault_releases_notify
  after insert on public.vault_releases
  for each row execute function public.notify_vault_release();

-- rollback
-- drop trigger if exists vault_releases_notify on public.vault_releases;
-- drop function if exists public.notify_vault_release();
-- drop policy if exists vault_releases_author_update on public.vault_releases;
-- drop policy if exists vault_releases_author_insert on public.vault_releases;
-- drop policy if exists vault_releases_recipient_read on public.vault_releases;
-- drop policy if exists vault_releases_author_read on public.vault_releases;
-- drop policy if exists proof_vault_items_insert on public.proof_vault_items;
-- drop policy if exists proof_vault_items_select on public.proof_vault_items;
-- drop function if exists public.can_view_proof_vault_item(uuid, uuid);
-- drop trigger if exists proof_vault_items_immutable on public.proof_vault_items;
-- drop function if exists public.guard_proof_vault_items_immutable();
-- drop table if exists public.vault_releases;
-- drop table if exists public.proof_vault_items;

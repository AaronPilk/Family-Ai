-- forward
-- =============================================================================
-- Batch C — family_invite_links (shareable invite URLs)
-- =============================================================================
-- Goal: Aaron drops one link in his family group chat. Everyone clicks it,
-- signs up, and lands in his family circle automatically. No per-person
-- email entry. This is the viral-loop primitive.
--
-- Shape:
--   - One row per shareable link.
--   - `token` is URL-safe base64 of 12 random bytes (~16 chars).
--   - Optional expiry and max-uses for sensitive cases. Default: no expiry,
--     no use cap (matches typical Discord/Slack invite behavior).
--   - `revoked_at` lets the host invalidate a link without deleting the row.
--
-- A security-definer RPC `claim_family_invite(token)` does the join atomically:
-- validates the token, inserts a family_memberships row (idempotent), bumps the
-- use count. RPC is the only client-facing entry point — direct INSERT to
-- family_memberships from a freshly signed-in stranger would be blocked by RLS.
--
-- ROLLBACK: see bottom of file.

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------

-- Postgres doesn't have a built-in base64url encoder, but we can fake it by
-- stripping `+/=` from regular base64 and replacing with `-_`. Length 16-ish
-- after stripping padding, plenty of entropy for invite links.
create or replace function public._gen_invite_token()
returns text
language sql
volatile
set search_path = public
as $$
  select translate(
    encode(extensions.gen_random_bytes(12), 'base64'),
    '+/=',
    '-_'
  );
$$;

create table if not exists public.family_invite_links (
  id                  uuid primary key default gen_random_uuid(),
  circle_id           uuid not null references public.family_circles(id) on delete cascade,
  token               text not null unique default public._gen_invite_token(),
  created_by_user_id  uuid not null references public.users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz,
  max_uses            int,
  uses                int not null default 0,
  revoked_at          timestamptz,
  label               text -- optional, e.g. "Mom's side" or "Group chat link"
);

create index family_invite_links_circle_idx
  on public.family_invite_links (circle_id);

create unique index family_invite_links_active_circle_idx
  on public.family_invite_links (circle_id)
  where revoked_at is null;
-- One active link per circle at a time. Regeneration revokes the previous one.

comment on table public.family_invite_links is
  'Shareable invite URLs for joining a family circle. One active link per circle at a time.';

-- -----------------------------------------------------------------------------
-- 2. RLS — only circle members can SELECT; only host (admin) can INSERT/UPDATE
-- -----------------------------------------------------------------------------

alter table public.family_invite_links enable row level security;

drop policy if exists family_invite_links_select on public.family_invite_links;
create policy family_invite_links_select on public.family_invite_links
  for select using (
    public.is_circle_member(auth.uid(), circle_id)
  );

drop policy if exists family_invite_links_insert on public.family_invite_links;
create policy family_invite_links_insert on public.family_invite_links
  for insert with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1 from public.family_memberships
      where circle_id = family_invite_links.circle_id
        and user_id = auth.uid()
        and role = 'admin'
        and removed_at is null
    )
  );

drop policy if exists family_invite_links_update on public.family_invite_links;
create policy family_invite_links_update on public.family_invite_links
  for update using (
    exists (
      select 1 from public.family_memberships
      where circle_id = family_invite_links.circle_id
        and user_id = auth.uid()
        and role = 'admin'
        and removed_at is null
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Claim RPC — security definer so non-members can call it to join
-- -----------------------------------------------------------------------------

create or replace function public.claim_family_invite(_token text)
returns table (
  circle_id    uuid,
  circle_name  text,
  joined_new   boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite    public.family_invite_links%rowtype;
  v_inserted  boolean;
begin
  -- Caller must be authenticated.
  if auth.uid() is null then
    raise exception 'Must be signed in to claim an invite link';
  end if;

  -- Find the invite. Single statement, no race.
  select * into v_invite
    from public.family_invite_links
   where token = _token
     and revoked_at is null
     and (expires_at is null or expires_at > now())
     and (max_uses is null or uses < max_uses)
   limit 1;

  if v_invite.id is null then
    raise exception 'This invite link is invalid, expired, or has been used up';
  end if;

  -- Insert membership; ON CONFLICT keeps idempotency if the user re-clicks the
  -- link. We do NOT bump `uses` when the user was already a member, otherwise
  -- a single user spamming the link would burn through max_uses.
  insert into public.family_memberships (circle_id, user_id, role, is_immediate)
  values (v_invite.circle_id, auth.uid(), 'member', false)
  on conflict (circle_id, user_id) do nothing
  returning true into v_inserted;

  if v_inserted is not null then
    update public.family_invite_links
       set uses = uses + 1
     where id = v_invite.id;
  end if;

  return query
    select fc.id,
           fc.name,
           coalesce(v_inserted, false)
      from public.family_circles fc
     where fc.id = v_invite.circle_id;
end;
$$;

grant execute on function public.claim_family_invite(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Regenerate helper — revokes current, returns new
-- -----------------------------------------------------------------------------

create or replace function public.regenerate_family_invite(_circle_id uuid)
returns public.family_invite_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new public.family_invite_links;
begin
  -- Only admins can regenerate.
  if not exists (
    select 1 from public.family_memberships
    where circle_id = _circle_id
      and user_id = auth.uid()
      and role = 'admin'
      and removed_at is null
  ) then
    raise exception 'Only family admins can regenerate the invite link';
  end if;

  -- Revoke any active link.
  update public.family_invite_links
     set revoked_at = now()
   where circle_id = _circle_id
     and revoked_at is null;

  -- Insert a fresh one. created_by = caller.
  insert into public.family_invite_links (circle_id, created_by_user_id)
  values (_circle_id, auth.uid())
  returning * into v_new;

  return v_new;
end;
$$;

grant execute on function public.regenerate_family_invite(uuid) to authenticated;

-- rollback
-- drop function if exists public.regenerate_family_invite(uuid);
-- drop function if exists public.claim_family_invite(text);
-- drop policy if exists family_invite_links_update on public.family_invite_links;
-- drop policy if exists family_invite_links_insert on public.family_invite_links;
-- drop policy if exists family_invite_links_select on public.family_invite_links;
-- drop table if exists public.family_invite_links;
-- drop function if exists public._gen_invite_token();

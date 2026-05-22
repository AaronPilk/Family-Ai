-- forward
-- =============================================================================
-- Family graph — invite-cascade, relationship tagging, branch grouping
-- =============================================================================
-- Goal: Aaron's "circle" stops being flat. Two rings now exist:
--
--   IMMEDIATE family — the ~6-person inner ring (spouse, parent, sibling,
--     grandparent, child, grandchild). Manually tagged by the viewer. Default
--     audience for heavy content: Vault releases, Letters.
--
--   EXTENDED family — everyone else who joined via the user's invite link, or
--     who cascaded into the circle through someone else's link. Default
--     audience for Events and chat.
--
-- Cascade rule (the product decision driving this migration):
--   When anyone claims any invite link, they:
--     1. Join the inviter's circle directly as is_immediate = false,
--        recording invited_via_user_id = inviter's user id.
--     2. ALSO join every OTHER circle the inviter is a member of, same way.
--        This is one-hop only — we do not recurse through their memberships.
--
-- Example: Aaron invites Mom → Mom lands in Aaron's circle.
--   Mom later invites 40 cousins via her own link → cousins land in Mom's
--   circle directly, AND because Mom is a member of Aaron's circle, they also
--   land in Aaron's circle as extended, each with invited_via_user_id = Mom.
--   The UI groups them under "Through Mom · 40 people".
--
-- The cascade walks the inviter's memberships unconditionally — whether the
-- inviter is immediate or extended in those circles is irrelevant. This is the
-- "aunt as organizer" case: when she invites cousins, those cousins land in
-- every circle she's already in.
--
-- This migration also adds two helpers:
--   - tag_family_relationship(target, label) — sets a relationship row from
--     auth.uid() → target. If the label is one of the "immediate" labels
--     (parent/child/grandparent/grandchild/sibling/spouse) it also flips the
--     target's family_memberships.is_immediate = true in the caller's circle.
--   - extended_family_branches(circle_id) — returns rows of (via_user_id,
--     branch_name, member_count) for the Family tab's branch grouping.
--
-- ROLLBACK: see bottom.

-- -----------------------------------------------------------------------------
-- 1. family_memberships.invited_via_user_id
-- -----------------------------------------------------------------------------
-- Nullable on purpose — pre-existing rows have no provenance, and the circle
-- owner / admin has no inviter.

alter table public.family_memberships
  add column if not exists invited_via_user_id uuid references public.users(id);

create index if not exists family_memberships_via_idx
  on public.family_memberships (circle_id, invited_via_user_id)
  where removed_at is null and invited_via_user_id is not null;

comment on column public.family_memberships.invited_via_user_id is
  'The user whose invite link (directly or via cascade) caused this membership. Null for the circle creator and pre-cascade rows. Used by the Family tab to group extended members by branch.';

-- -----------------------------------------------------------------------------
-- 2. relationships.relationship_type — add 'in_law' and 'family_friend'
-- -----------------------------------------------------------------------------
-- The original CHECK constraint in 20260101000003_family.sql doesn't include
-- 'in_law' or 'family_friend'. Both are listed as valid relationship labels in
-- the Family tab "Who is this to you?" picker, so widen the constraint.

alter table public.relationships
  drop constraint if exists relationships_relationship_type_check;

alter table public.relationships
  add constraint relationships_relationship_type_check
  check (relationship_type in (
    'parent','child','grandparent','grandchild','sibling',
    'spouse','aunt_uncle','niece_nephew','cousin',
    'in_law','chosen_family','family_friend','custom'
  ));

-- -----------------------------------------------------------------------------
-- 3. Rewrite claim_family_invite — cascade into inviter's other circles
-- -----------------------------------------------------------------------------
-- Drop the previous signature first so we can safely replace the body.

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
  v_invite      public.family_invite_links%rowtype;
  v_inviter_id  uuid;
  v_uid         uuid := auth.uid();
  v_direct_inserted_any boolean := false;
  v_cascade_circle uuid;
begin
  -- Caller must be authenticated.
  if v_uid is null then
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

  v_inviter_id := v_invite.created_by_user_id;

  -- 3a. Insert direct membership in the link's own circle. The inviter is the
  -- link creator, so invited_via_user_id = inviter even though this is the
  -- "direct" branch — branches are keyed on the via-user for the whole row.
  -- ON CONFLICT keeps idempotency if the user re-clicks.
  insert into public.family_memberships (
    circle_id, user_id, role, is_immediate, invited_via_user_id
  )
  values (
    v_invite.circle_id, v_uid, 'member', false, v_inviter_id
  )
  on conflict (circle_id, user_id) do nothing;

  if found then
    v_direct_inserted_any := true;
  end if;

  -- 3b. Cascade — one hop. For every OTHER active circle the inviter belongs
  -- to, add the newcomer there too. Skip the link's circle (already inserted)
  -- and skip any circle the newcomer is already in.
  for v_cascade_circle in
    select fm.circle_id
      from public.family_memberships fm
     where fm.user_id = v_inviter_id
       and fm.removed_at is null
       and fm.circle_id <> v_invite.circle_id
  loop
    insert into public.family_memberships (
      circle_id, user_id, role, is_immediate, invited_via_user_id
    )
    values (
      v_cascade_circle, v_uid, 'member', false, v_inviter_id
    )
    on conflict (circle_id, user_id) do nothing;
  end loop;

  -- 3c. Bump uses only if SOMETHING was actually inserted. Re-clicks by an
  -- existing member don't burn through max_uses.
  if v_direct_inserted_any then
    update public.family_invite_links
       set uses = uses + 1
     where id = v_invite.id;
  end if;

  return query
    select fc.id,
           fc.name,
           v_direct_inserted_any
      from public.family_circles fc
     where fc.id = v_invite.circle_id;
end;
$$;

grant execute on function public.claim_family_invite(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. tag_family_relationship — viewer says "Mom is my parent"
-- -----------------------------------------------------------------------------
-- Inserts (or upserts) a relationships row from auth.uid() → target with the
-- given label. If the label is one of the inner-ring labels, also flips
-- family_memberships.is_immediate = true for the target in the caller's
-- primary shared circle.
--
-- Returns the (circle_id, is_immediate) so the UI can react.

create or replace function public.tag_family_relationship(
  _member_user_id     uuid,
  _relationship_type  text
)
returns table (
  circle_id    uuid,
  is_immediate boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_circle    uuid;
  v_immediate boolean;
begin
  if v_uid is null then
    raise exception 'Must be signed in to tag a relationship';
  end if;

  if _member_user_id = v_uid then
    raise exception 'You cannot tag a relationship to yourself';
  end if;

  if _relationship_type not in (
    'parent','child','grandparent','grandchild','sibling',
    'spouse','aunt_uncle','niece_nephew','cousin',
    'in_law','chosen_family','family_friend','custom'
  ) then
    raise exception 'Invalid relationship type: %', _relationship_type;
  end if;

  -- Find a circle the caller and target both belong to. Prefer the caller's
  -- primary (earliest joined) circle that the target is also active in, so
  -- the row anchors to the user's main family rather than a side branch.
  select fm_caller.circle_id
    into v_circle
    from public.family_memberships fm_caller
    join public.family_memberships fm_target
      on fm_target.circle_id = fm_caller.circle_id
   where fm_caller.user_id = v_uid
     and fm_caller.removed_at is null
     and fm_target.user_id = _member_user_id
     and fm_target.removed_at is null
   order by fm_caller.joined_at asc nulls last
   limit 1;

  if v_circle is null then
    raise exception 'No shared family circle with that member';
  end if;

  v_immediate := _relationship_type in (
    'parent','child','grandparent','grandchild','sibling','spouse'
  );

  -- Upsert the relationship row. Unique constraint is
  -- (circle_id, from_user_id, to_user_id).
  insert into public.relationships (
    circle_id, from_user_id, to_user_id, relationship_type
  )
  values (
    v_circle, v_uid, _member_user_id, _relationship_type
  )
  on conflict (circle_id, from_user_id, to_user_id)
  do update set relationship_type = excluded.relationship_type;

  -- Flip is_immediate on the TARGET's membership row in this circle. The
  -- column is viewer-scoped in concept but the table only has one row per
  -- (circle, user), so we just set it on the target's row. (The current schema
  -- doesn't yet support multi-viewer immediate flags; if that becomes a real
  -- requirement we'll need a separate immediate_marks table.)
  if v_immediate then
    update public.family_memberships
       set is_immediate = true
     where circle_id = v_circle
       and user_id = _member_user_id
       and removed_at is null;
  end if;

  return query select v_circle, v_immediate;
end;
$$;

grant execute on function public.tag_family_relationship(uuid, text) to authenticated;

comment on function public.tag_family_relationship(uuid, text) is
  'Viewer declares their relationship to another circle member. Inserts/updates relationships row and flips is_immediate when the label is an inner-ring type (parent/child/grandparent/grandchild/sibling/spouse).';

-- -----------------------------------------------------------------------------
-- 5. extended_family_branches — grouped view for the Family tab
-- -----------------------------------------------------------------------------
-- Returns one row per branch (= per via-user) in the given circle, with the
-- branch's name (via-user's display_name) and active member count.
-- Excludes the caller themselves so the UI doesn't render a self-branch.

create or replace function public.extended_family_branches(_circle_id uuid)
returns table (
  invited_via_user_id uuid,
  branch_name         text,
  member_count        bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    fm.invited_via_user_id,
    coalesce(p.display_name, 'Family member') as branch_name,
    count(*)::bigint as member_count
  from public.family_memberships fm
  left join public.profiles p
    on p.user_id = fm.invited_via_user_id
  where fm.circle_id = _circle_id
    and fm.removed_at is null
    and fm.invited_via_user_id is not null
    and fm.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and fm.is_immediate = false
  group by fm.invited_via_user_id, p.display_name
  order by member_count desc, branch_name asc;
$$;

grant execute on function public.extended_family_branches(uuid) to authenticated;

comment on function public.extended_family_branches(uuid) is
  'Branch grouping for the Family tab. Returns (via_user_id, branch_name, member_count) for each extended-family branch in the given circle.';

-- rollback
-- drop function if exists public.extended_family_branches(uuid);
-- drop function if exists public.tag_family_relationship(uuid, text);
-- (claim_family_invite — keep the function but the previous body is in
--  20260522000004_family_invite_links.sql; manual revert needed.)
-- alter table public.relationships drop constraint if exists relationships_relationship_type_check;
-- alter table public.relationships
--   add constraint relationships_relationship_type_check
--   check (relationship_type in (
--     'parent','child','grandparent','grandchild','sibling',
--     'spouse','aunt_uncle','niece_nephew','cousin',
--     'chosen_family','custom'
--   ));
-- drop index if exists family_memberships_via_idx;
-- alter table public.family_memberships drop column if exists invited_via_user_id;

-- forward
-- =============================================================================
-- relationships.gender_hint + extended tag_family_relationship RPC
-- =============================================================================
-- The "Who is this to you?" picker only knows the target's gender if they
-- themselves declared it during onboarding. Many people invited via SMS
-- never complete onboarding (they have a profile but no gender), so the
-- picker fell back to the neutral label "Sibling" with no way for the
-- tagger to declare "Brother" or "Sister".
--
-- This migration lets the tagger record their *perceived* gender for the
-- relationship without overwriting the target's own profile.gender:
--
--   1. Add `relationships.gender_hint` — the tagger's perception. Nullable.
--   2. Extend `tag_family_relationship` to accept an optional gender hint.
--      Default null preserves callers that pass only (member, type).
--   3. The client-side label resolver prefers gender_hint over the target's
--      profile.gender for THIS viewer's view. The target's self-declared
--      profile.gender is never written by this path.
--
-- ROLLBACK: see bottom.

-- -----------------------------------------------------------------------------
-- 1. New column on relationships
-- -----------------------------------------------------------------------------

alter table public.relationships
  add column if not exists gender_hint text;

alter table public.relationships
  drop constraint if exists relationships_gender_hint_check;

alter table public.relationships
  add constraint relationships_gender_hint_check
  check (gender_hint is null or gender_hint in ('female', 'male', 'nonbinary', 'prefer_not'));

comment on column public.relationships.gender_hint is
  'Tagger''s perceived gender of the target for this relationship. Used by the picker / family-tree label resolver to pick gendered forms ("Brother"/"Sister") when the target hasn''t declared their own profile.gender. NEVER written back to profiles.gender — the target''s self-declared gender stays authoritative.';

-- -----------------------------------------------------------------------------
-- 2. Drop and recreate tag_family_relationship with optional _gender_hint
-- -----------------------------------------------------------------------------
-- We DROP first because Postgres treats default-value-only changes as a new
-- function signature; CREATE OR REPLACE alone can't add a defaulted param
-- when the function already has the same return shape.

drop function if exists public.tag_family_relationship(uuid, text);
drop function if exists public.tag_family_relationship(uuid, text, text);

create or replace function public.tag_family_relationship(
  _member_user_id     uuid,
  _relationship_type  text,
  _gender_hint        text default null
)
returns table (
  out_circle_id    uuid,
  out_is_immediate boolean
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

  if _gender_hint is not null and _gender_hint not in (
    'female','male','nonbinary','prefer_not'
  ) then
    raise exception 'Invalid gender hint: %', _gender_hint;
  end if;

  -- Find a circle the caller and target both belong to. Prefer the caller's
  -- primary (earliest joined) circle that the target is also active in.
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

  -- Upsert the relationship row including the gender hint.
  insert into public.relationships (
    circle_id, from_user_id, to_user_id, relationship_type, gender_hint
  )
  values (
    v_circle, v_uid, _member_user_id, _relationship_type, _gender_hint
  )
  on conflict (circle_id, from_user_id, to_user_id)
  do update set
    relationship_type = excluded.relationship_type,
    gender_hint       = excluded.gender_hint;

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

grant execute on function public.tag_family_relationship(uuid, text, text) to authenticated;

comment on function public.tag_family_relationship(uuid, text, text) is
  'Viewer declares their relationship to another circle member. Optional gender_hint records the tagger''s perception (Brother vs Sister vs Sibling) without modifying the target''s own profile.gender. Inserts/updates relationships row and flips is_immediate when the label is an inner-ring type.';

-- rollback
-- drop function if exists public.tag_family_relationship(uuid, text, text);
-- create or replace function public.tag_family_relationship(
--   _member_user_id    uuid,
--   _relationship_type text
-- )
-- returns table (out_circle_id uuid, out_is_immediate boolean)
-- ... (restore prior body from 20260522000019_tag_outparams.sql or 20260522000014)
-- alter table public.relationships drop constraint if exists relationships_gender_hint_check;
-- alter table public.relationships drop column if exists gender_hint;

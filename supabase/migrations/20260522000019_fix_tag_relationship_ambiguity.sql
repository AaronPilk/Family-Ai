-- forward
-- =============================================================================
-- Fix: tag_family_relationship — qualify ambiguous circle_id reference
-- =============================================================================
-- The previous version (in 20260522000014_family_graph.sql) declared
-- `circle_id` as both a RETURNS TABLE column AND used unqualified `circle_id`
-- in WHERE/UPDATE clauses against family_memberships. Postgres reports
-- "column reference circle_id is ambiguous" because it can't tell whether
-- the WHERE refers to the OUT parameter or the table column.
--
-- Fix: qualify every column reference in the function body, and rename the
-- OUT params with a `_out` prefix so future maintainers don't trip on this.

drop function if exists public.tag_family_relationship(uuid, text);

create or replace function public.tag_family_relationship(
  _member_user_id     uuid,
  _relationship_type  text
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

  -- Find a shared circle between caller and target. Prefer the caller's
  -- primary (earliest joined) circle that the target is also in.
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

  -- Upsert the relationship row — fully qualified column refs.
  insert into public.relationships as r (
    circle_id, from_user_id, to_user_id, relationship_type
  )
  values (
    v_circle, v_uid, _member_user_id, _relationship_type
  )
  on conflict (circle_id, from_user_id, to_user_id)
  do update set relationship_type = excluded.relationship_type;

  -- Flip is_immediate on the target's membership row — qualify every column.
  if v_immediate then
    update public.family_memberships fm
       set is_immediate = true
     where fm.circle_id = v_circle
       and fm.user_id = _member_user_id
       and fm.removed_at is null;
  end if;

  return query select v_circle, v_immediate;
end;
$$;

grant execute on function public.tag_family_relationship(uuid, text) to authenticated;

comment on function public.tag_family_relationship(uuid, text) is
  'Viewer declares their relationship to another circle member. Inserts/updates relationships row and flips is_immediate for inner-ring labels. Out columns prefixed out_ to avoid shadow conflicts with table column names.';

-- rollback: see 20260522000014 for the prior body.

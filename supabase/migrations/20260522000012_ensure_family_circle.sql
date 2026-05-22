-- forward
-- =============================================================================
-- ensure_family_circle — self-heal RPC for users without a circle
-- =============================================================================
-- Background: extend_signup_trigger (migration 20260522000002) creates a
-- family_circle on every new auth.users insert. But any account that existed
-- BEFORE that migration was applied has no circle. They land on /invite, the
-- code looks for their primary circle membership, finds nothing, and dies.
--
-- This RPC fixes that. It's idempotent: returns the user's existing primary
-- circle if they have one, otherwise creates a new circle named
-- "<display_name>'s family" and adds the user as admin. Safe to call from any
-- screen as a self-heal step.
--
-- The /invite screen is the most natural caller, but we can also wire it into
-- the root gate to retroactively repair every signed-in user the first time
-- they open the app post-deploy.
--
-- ROLLBACK: see bottom of file.

create or replace function public.ensure_family_circle()
returns table (
  circle_id   uuid,
  circle_name text,
  created_new boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_circle_id   uuid;
  v_circle_name text;
  v_display     text;
begin
  if v_uid is null then
    raise exception 'Must be signed in to ensure a family circle';
  end if;

  -- 1. Look for an existing primary membership (earliest joined, non-removed).
  select fm.circle_id, fc.name
    into v_circle_id, v_circle_name
    from public.family_memberships fm
    join public.family_circles fc on fc.id = fm.circle_id
   where fm.user_id = v_uid
     and fm.removed_at is null
   order by fm.joined_at asc nulls last
   limit 1;

  if v_circle_id is not null then
    return query select v_circle_id, v_circle_name, false;
    return;
  end if;

  -- 2. No circle yet — derive a display name and create one.
  select coalesce(p.display_name, split_part(u.email, '@', 1), 'New member')
    into v_display
    from public.users u
    left join public.profiles p on p.user_id = u.id
   where u.id = v_uid;

  if v_display is null or length(trim(v_display)) = 0 then
    v_display := 'New member';
  end if;

  -- Backfill profile if it's missing entirely.
  insert into public.profiles (
    user_id,
    display_name,
    default_visibility_rule_id
  )
  values (
    v_uid,
    v_display,
    (select id from public.visibility_rules order by created_at asc limit 1)
  )
  on conflict (user_id) do nothing;

  -- Create the circle.
  v_circle_name := v_display || '''s family';
  insert into public.family_circles (name, created_by)
  values (v_circle_name, v_uid)
  returning id into v_circle_id;

  -- Admin membership.
  insert into public.family_memberships (circle_id, user_id, role, is_immediate)
  values (v_circle_id, v_uid, 'admin', true)
  on conflict do nothing;

  return query select v_circle_id, v_circle_name, true;
end;
$$;

grant execute on function public.ensure_family_circle() to authenticated;

comment on function public.ensure_family_circle() is
  'Idempotent self-heal: returns the caller''s primary family circle, creating one if they have none. Use from /invite or root gate to repair accounts that predate the signup trigger.';

-- rollback
-- drop function if exists public.ensure_family_circle();

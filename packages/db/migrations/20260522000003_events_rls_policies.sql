-- forward
-- =============================================================================
-- Batch C — RLS policies for the events stack
-- =============================================================================
-- Migration 20260101000013_events.sql enabled RLS on every events_* table but
-- intentionally left the policy definitions as a TODO ("Real policies arrive
-- in the next hardening migration"). Without policies, RLS = deny-all for
-- non-superusers, which means production `fetchMyEvents()` returns []
-- and `createEvent()` always fails. This migration fills that gap.
--
-- Two security-definer helpers avoid recursion: `is_event_member` and
-- `is_circle_member`. Both bypass RLS only to check membership; they don't
-- expose any data, just return boolean.
--
-- Policy intent in plain English:
--   events:             host can do everything; guests can read; circle members
--                       of a primary_circle linked to the event can read.
--   event_circles:      readable by event members and circle members; only
--                       host can attach/detach circles.
--   event_guests:       readable by event members; host can invite anyone;
--                       a user can self-add a guest row (claim invite); the
--                       host can update any row; a user can update their own
--                       (RSVP); host can delete.
--   event_bring_items:  readable by event members; event members can create
--                       and claim; creator or host can delete.
--   event_polls:        readable by event members; host can create.
--   event_poll_options: readable by event members; host can create.
--   event_poll_votes:   readable by event members; users vote for themselves;
--                       users can un-vote (delete their own vote).
--   event_media:        readable by event members; posters can post; poster or
--                       host can delete.
--   event_highlights:   readable by event members; no client INSERT path —
--                       generated server-side by an edge function later.
--
-- ROLLBACK: see bottom of file.

-- -----------------------------------------------------------------------------
-- 1. Helpers
-- -----------------------------------------------------------------------------

create or replace function public.is_event_member(_event_id uuid, _user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.events
    where id = _event_id and host_user_id = _user_id and deleted_at is null
  ) or exists (
    select 1 from public.event_guests
    where event_id = _event_id and user_id = _user_id
  );
$$;

grant execute on function public.is_event_member(uuid, uuid) to authenticated;

create or replace function public.is_circle_member(_circle_id uuid, _user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.family_memberships
    where circle_id = _circle_id
      and user_id = _user_id
      and removed_at is null
  );
$$;

grant execute on function public.is_circle_member(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. events
-- -----------------------------------------------------------------------------

drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select using (
    deleted_at is null
    and (
      host_user_id = auth.uid()
      or exists (
        select 1 from public.event_guests g
        where g.event_id = events.id and g.user_id = auth.uid()
      )
      or exists (
        select 1 from public.event_circles ec
        join public.family_memberships fm on fm.circle_id = ec.circle_id
        where ec.event_id = events.id
          and fm.user_id = auth.uid()
          and fm.removed_at is null
      )
    )
  );

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert with check (
    host_user_id = auth.uid()
    and public.is_circle_member(primary_circle_id, auth.uid())
  );

drop policy if exists events_update_host on public.events;
create policy events_update_host on public.events
  for update using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());

drop policy if exists events_delete_host on public.events;
create policy events_delete_host on public.events
  for delete using (host_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. event_circles
-- -----------------------------------------------------------------------------

drop policy if exists event_circles_select on public.event_circles;
create policy event_circles_select on public.event_circles
  for select using (
    public.is_event_member(event_id, auth.uid())
    or public.is_circle_member(circle_id, auth.uid())
  );

drop policy if exists event_circles_insert on public.event_circles;
create policy event_circles_insert on public.event_circles
  for insert with check (
    exists (
      select 1 from public.events e
      where e.id = event_circles.event_id
        and e.host_user_id = auth.uid()
    )
  );

drop policy if exists event_circles_delete on public.event_circles;
create policy event_circles_delete on public.event_circles
  for delete using (
    exists (
      select 1 from public.events e
      where e.id = event_circles.event_id
        and e.host_user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 4. event_guests
-- -----------------------------------------------------------------------------

drop policy if exists event_guests_select on public.event_guests;
create policy event_guests_select on public.event_guests
  for select using (
    public.is_event_member(event_id, auth.uid())
  );

drop policy if exists event_guests_insert on public.event_guests;
create policy event_guests_insert on public.event_guests
  for insert with check (
    -- Host of the event can invite anyone (including by email).
    exists (
      select 1 from public.events e
      where e.id = event_guests.event_id
        and e.host_user_id = auth.uid()
    )
    -- Or the user is adding/claiming their own row.
    or user_id = auth.uid()
  );

drop policy if exists event_guests_update on public.event_guests;
create policy event_guests_update on public.event_guests
  for update using (
    user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_guests.event_id
        and e.host_user_id = auth.uid()
    )
  );

drop policy if exists event_guests_delete on public.event_guests;
create policy event_guests_delete on public.event_guests
  for delete using (
    exists (
      select 1 from public.events e
      where e.id = event_guests.event_id
        and e.host_user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 5. event_bring_items
-- -----------------------------------------------------------------------------

drop policy if exists event_bring_items_select on public.event_bring_items;
create policy event_bring_items_select on public.event_bring_items
  for select using (public.is_event_member(event_id, auth.uid()));

drop policy if exists event_bring_items_insert on public.event_bring_items;
create policy event_bring_items_insert on public.event_bring_items
  for insert with check (
    public.is_event_member(event_id, auth.uid())
    and (created_by_user_id is null or created_by_user_id = auth.uid())
  );

drop policy if exists event_bring_items_update on public.event_bring_items;
create policy event_bring_items_update on public.event_bring_items
  for update using (public.is_event_member(event_id, auth.uid()))
  with check (public.is_event_member(event_id, auth.uid()));

drop policy if exists event_bring_items_delete on public.event_bring_items;
create policy event_bring_items_delete on public.event_bring_items
  for delete using (
    created_by_user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_bring_items.event_id
        and e.host_user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 6. event_polls + options + votes
-- -----------------------------------------------------------------------------

drop policy if exists event_polls_select on public.event_polls;
create policy event_polls_select on public.event_polls
  for select using (public.is_event_member(event_id, auth.uid()));

drop policy if exists event_polls_insert on public.event_polls;
create policy event_polls_insert on public.event_polls
  for insert with check (
    exists (
      select 1 from public.events e
      where e.id = event_polls.event_id
        and e.host_user_id = auth.uid()
    )
  );

drop policy if exists event_poll_options_select on public.event_poll_options;
create policy event_poll_options_select on public.event_poll_options
  for select using (
    exists (
      select 1 from public.event_polls p
      where p.id = event_poll_options.poll_id
        and public.is_event_member(p.event_id, auth.uid())
    )
  );

drop policy if exists event_poll_options_insert on public.event_poll_options;
create policy event_poll_options_insert on public.event_poll_options
  for insert with check (
    exists (
      select 1 from public.event_polls p
      join public.events e on e.id = p.event_id
      where p.id = event_poll_options.poll_id
        and e.host_user_id = auth.uid()
    )
  );

drop policy if exists event_poll_votes_select on public.event_poll_votes;
create policy event_poll_votes_select on public.event_poll_votes
  for select using (
    exists (
      select 1 from public.event_poll_options po
      join public.event_polls p on p.id = po.poll_id
      where po.id = event_poll_votes.option_id
        and public.is_event_member(p.event_id, auth.uid())
    )
  );

drop policy if exists event_poll_votes_insert on public.event_poll_votes;
create policy event_poll_votes_insert on public.event_poll_votes
  for insert with check (
    voter_user_id = auth.uid()
    and exists (
      select 1 from public.event_poll_options po
      join public.event_polls p on p.id = po.poll_id
      where po.id = event_poll_votes.option_id
        and public.is_event_member(p.event_id, auth.uid())
    )
  );

drop policy if exists event_poll_votes_delete on public.event_poll_votes;
create policy event_poll_votes_delete on public.event_poll_votes
  for delete using (voter_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 7. event_media
-- -----------------------------------------------------------------------------

drop policy if exists event_media_select on public.event_media;
create policy event_media_select on public.event_media
  for select using (public.is_event_member(event_id, auth.uid()));

drop policy if exists event_media_insert on public.event_media;
create policy event_media_insert on public.event_media
  for insert with check (
    public.is_event_member(event_id, auth.uid())
    and posted_by_user_id = auth.uid()
  );

drop policy if exists event_media_delete on public.event_media;
create policy event_media_delete on public.event_media
  for delete using (
    posted_by_user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_media.event_id
        and e.host_user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 8. event_highlights
-- -----------------------------------------------------------------------------

drop policy if exists event_highlights_select on public.event_highlights;
create policy event_highlights_select on public.event_highlights
  for select using (public.is_event_member(event_id, auth.uid()));
-- No INSERT/UPDATE/DELETE policy — highlights are generated server-side by
-- an edge function with the service role, which bypasses RLS by design.

-- rollback
-- drop policy if exists event_highlights_select on public.event_highlights;
-- drop policy if exists event_media_delete on public.event_media;
-- drop policy if exists event_media_insert on public.event_media;
-- drop policy if exists event_media_select on public.event_media;
-- drop policy if exists event_poll_votes_delete on public.event_poll_votes;
-- drop policy if exists event_poll_votes_insert on public.event_poll_votes;
-- drop policy if exists event_poll_votes_select on public.event_poll_votes;
-- drop policy if exists event_poll_options_insert on public.event_poll_options;
-- drop policy if exists event_poll_options_select on public.event_poll_options;
-- drop policy if exists event_polls_insert on public.event_polls;
-- drop policy if exists event_polls_select on public.event_polls;
-- drop policy if exists event_bring_items_delete on public.event_bring_items;
-- drop policy if exists event_bring_items_update on public.event_bring_items;
-- drop policy if exists event_bring_items_insert on public.event_bring_items;
-- drop policy if exists event_bring_items_select on public.event_bring_items;
-- drop policy if exists event_guests_delete on public.event_guests;
-- drop policy if exists event_guests_update on public.event_guests;
-- drop policy if exists event_guests_insert on public.event_guests;
-- drop policy if exists event_guests_select on public.event_guests;
-- drop policy if exists event_circles_delete on public.event_circles;
-- drop policy if exists event_circles_insert on public.event_circles;
-- drop policy if exists event_circles_select on public.event_circles;
-- drop policy if exists events_delete_host on public.events;
-- drop policy if exists events_update_host on public.events;
-- drop policy if exists events_insert on public.events;
-- drop policy if exists events_select on public.events;
-- drop function if exists public.is_circle_member(uuid, uuid);
-- drop function if exists public.is_event_member(uuid, uuid);

-- forward
-- =============================================================================
-- event_guests insert → push notification to the invited user
-- =============================================================================
-- When the host invites a family member to an event from inside the app
-- (via inviteFamilyMembersToEvent / the /moment/[id]/invite-guests screen),
-- the invitee should be notified immediately. Without this trigger they'd
-- have no idea they'd been added unless they manually open the events tab.
--
-- Pattern mirrors the existing letter / event_message / family-join push
-- triggers in 20260522000017_push_triggers.sql — best-effort dispatch via
-- public.send_push_notification, swallow failures so a push outage never
-- aborts the originating insert.
--
-- Only fires for rows with a non-null user_id (a real circle member). Rows
-- with user_id IS NULL are email-only invites (claimed later when the
-- invitee signs up) and have no push subscription yet.
--
-- Self-invites (host row inserted during event creation) are filtered out
-- — `is_host = true` rows shouldn't ping the host themselves.
--
-- ROLLBACK: see bottom.

create or replace function public.tg_push_event_guest_invited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_name  text;
  v_event_title text;
begin
  -- Skip null-user (email-only) and self-invites.
  if new.user_id is null then return new; end if;
  if coalesce(new.is_host, false) then return new; end if;
  if new.invited_by_user_id is not null
     and new.invited_by_user_id = new.user_id then
    return new;
  end if;

  select coalesce(p.display_name, 'Someone in your family')
    into v_host_name
    from public.profiles p
   where p.user_id = new.invited_by_user_id;

  select coalesce(e.title, 'an event')
    into v_event_title
    from public.events e
   where e.id = new.event_id;

  perform public.send_push_notification(
    new.user_id,
    'You''re invited',
    coalesce(v_host_name, 'Someone') || ' invited you to ' || coalesce(v_event_title, 'an event') || '.',
    '/moment/' || new.event_id::text
  );

  return new;
end;
$$;

drop trigger if exists event_guests_invited_push_trg on public.event_guests;
create trigger event_guests_invited_push_trg
  after insert on public.event_guests
  for each row execute function public.tg_push_event_guest_invited();

-- rollback
-- drop trigger if exists event_guests_invited_push_trg on public.event_guests;
-- drop function if exists public.tg_push_event_guest_invited();

-- forward
-- =============================================================================
-- Push notification triggers
-- =============================================================================
-- We want three real-time push notifications:
--   1. Family member joined  (family_memberships insert)
--   2. New event chat message (event_messages insert)
--   3. Letter delivered       (letters insert)
--
-- Implementation: pg_net.http_post → public Edge Function `send_push`.
-- pg_net is enabled by default on hosted Supabase projects.
--
-- The Edge Function URL and SERVICE_ROLE_KEY come from Postgres GUC settings
-- the project owner must set ONCE per project via the SQL editor:
--
--   alter database postgres set app.settings.supabase_url
--     = 'https://<ref>.supabase.co';
--   alter database postgres set app.settings.service_role_key
--     = '<service role key>';
--
-- (Both commands are in WEB-PUSH-DEPLOY.md.)
--
-- If pg_net is somehow unavailable (e.g. local dev without the extension), the
-- triggers degrade gracefully: the helper function below catches and logs the
-- error rather than aborting the originating insert. Notifications are
-- best-effort by design — we never want a push outage to break a letter send.
--
-- ROLLBACK: see bottom.

-- -----------------------------------------------------------------------------
-- 0. Required extension. pg_net should already be installed on hosted Supabase.
-- -----------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. Helper: public.send_push_notification(user_id, title, body, url)
-- -----------------------------------------------------------------------------
-- Wraps the HTTP POST to the send_push edge function. SECURITY DEFINER so
-- triggers can fire it without granting pg_net rights to authenticated.

create or replace function public.send_push_notification(
  _user_id uuid,
  _title   text,
  _body    text,
  _url     text default '/'
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text;
  v_key    text;
  v_body   jsonb;
begin
  v_url := current_setting('app.settings.supabase_url', true);
  v_key := current_setting('app.settings.service_role_key', true);

  -- If either setting is missing, no-op. We deliberately do NOT raise here
  -- because the originating insert (a chat message, a letter, a join) is the
  -- user's real intent; a missing push config is an ops issue, not a user
  -- error. Log a notice so it shows up in the Postgres logs.
  if v_url is null or v_key is null or v_url = '' or v_key = '' then
    raise notice 'send_push_notification: app.settings.supabase_url / service_role_key not set; skipping';
    return;
  end if;

  v_body := jsonb_build_object(
    'user_id', _user_id,
    'title',   _title,
    'body',    _body,
    'url',     coalesce(_url, '/')
  );

  begin
    perform extensions.http_post(
      url     := v_url || '/functions/v1/send_push',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := v_body
    );
  exception
    when others then
      -- Best-effort. Never let a push failure abort a write.
      raise notice 'send_push_notification: pg_net post failed: %', sqlerrm;
  end;
end;
$$;

grant execute on function public.send_push_notification(uuid, text, text, text) to service_role;

comment on function public.send_push_notification(uuid, text, text, text) is
  'Best-effort push notification dispatch via the send_push edge function. Reads supabase_url + service_role_key from project GUCs; silently no-ops if either is missing.';

-- -----------------------------------------------------------------------------
-- 2. Trigger: family_memberships insert → notify the inviter
-- -----------------------------------------------------------------------------

create or replace function public.tg_push_family_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joiner_name text;
begin
  if new.invited_via_user_id is null then
    return new;
  end if;
  -- Self-invite shouldn't ping (no realistic path to it, but defend in depth).
  if new.invited_via_user_id = new.user_id then
    return new;
  end if;

  select coalesce(p.display_name, 'Someone in your family')
    into v_joiner_name
    from public.profiles p
   where p.user_id = new.user_id;

  perform public.send_push_notification(
    new.invited_via_user_id,
    'Someone joined your family',
    coalesce(v_joiner_name, 'Someone') || ' just joined your family on FamLink.',
    '/family'
  );

  return new;
end;
$$;

drop trigger if exists family_memberships_push_trg on public.family_memberships;
create trigger family_memberships_push_trg
  after insert on public.family_memberships
  for each row execute function public.tg_push_family_joined();

-- -----------------------------------------------------------------------------
-- 3. Trigger: event_messages insert → notify every other event member
-- -----------------------------------------------------------------------------

create or replace function public.tg_push_event_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
  v_event_title text;
  v_preview     text;
  v_recipient   uuid;
begin
  select coalesce(p.display_name, 'Someone')
    into v_sender_name
    from public.profiles p
   where p.user_id = new.author_user_id;

  select coalesce(e.title, 'your event')
    into v_event_title
    from public.events e
   where e.id = new.event_id;

  -- Trim message preview to 60 chars; collapse newlines.
  v_preview := regexp_replace(new.body, E'\\s+', ' ', 'g');
  if char_length(v_preview) > 60 then
    v_preview := substring(v_preview from 1 for 57) || '…';
  end if;

  -- Notify every active guest of this event, except the sender.
  for v_recipient in
    select g.user_id
      from public.event_guests g
     where g.event_id = new.event_id
       and g.user_id is not null
       and g.user_id <> new.author_user_id
  loop
    perform public.send_push_notification(
      v_recipient,
      v_event_title,
      v_sender_name || ': ' || v_preview,
      '/event/' || new.event_id::text
    );
  end loop;

  -- Also notify the host if they're not also a guest row (some setups don't
  -- duplicate the host into event_guests).
  for v_recipient in
    select e.host_user_id
      from public.events e
     where e.id = new.event_id
       and e.host_user_id is not null
       and e.host_user_id <> new.author_user_id
       and not exists (
         select 1 from public.event_guests g
          where g.event_id = e.id
            and g.user_id = e.host_user_id
       )
  loop
    perform public.send_push_notification(
      v_recipient,
      v_event_title,
      v_sender_name || ': ' || v_preview,
      '/event/' || new.event_id::text
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists event_messages_push_trg on public.event_messages;
create trigger event_messages_push_trg
  after insert on public.event_messages
  for each row execute function public.tg_push_event_message();

-- -----------------------------------------------------------------------------
-- 4. Trigger: letters insert → notify recipient (without revealing content)
-- -----------------------------------------------------------------------------

create or replace function public.tg_push_letter_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
begin
  if new.recipient_user_id = new.sender_user_id then
    return new;
  end if;

  select coalesce(p.display_name, 'Someone in your family')
    into v_sender_name
    from public.profiles p
   where p.user_id = new.sender_user_id;

  -- Deliberately generic body — no preview, no excerpt. Letters are private,
  -- and the recipient may want to choose when/where to read them.
  perform public.send_push_notification(
    new.recipient_user_id,
    'You have a new letter',
    coalesce(v_sender_name, 'Someone') || ' sent you a letter.',
    '/letters'
  );

  return new;
end;
$$;

drop trigger if exists letters_push_trg on public.letters;
create trigger letters_push_trg
  after insert on public.letters
  for each row execute function public.tg_push_letter_delivered();

-- rollback
-- drop trigger if exists letters_push_trg on public.letters;
-- drop trigger if exists event_messages_push_trg on public.event_messages;
-- drop trigger if exists family_memberships_push_trg on public.family_memberships;
-- drop function if exists public.tg_push_letter_delivered();
-- drop function if exists public.tg_push_event_message();
-- drop function if exists public.tg_push_family_joined();
-- drop function if exists public.send_push_notification(uuid, text, text, text);

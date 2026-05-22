-- forward
-- =============================================================================
-- send_push_notification: Vault-backed, net.http_post-based push dispatch
-- =============================================================================
-- Supersedes the GUC-based helper in 20260522000017_push_triggers.sql, which
-- broke on hosted Supabase because:
--
--   1. ALTER DATABASE postgres SET app.settings.* is denied for the postgres
--      role on hosted Supabase (error 42501). The GUC reads always returned
--      NULL, the helper hit its silent no-op branch on every trigger fire,
--      and no push ever went out.
--
--   2. pg_net always installs its functions in the `net` schema regardless of
--      where you install the extension itself. The original helper called
--      `extensions.http_post`, which doesn't exist — the call threw
--      "function does not exist", got caught by the `when others then` block,
--      and was silently swallowed as a notice.
--
-- This version:
--   - Reads the service role secret from Supabase Vault (see prerequisite).
--   - Hardcodes the project URL (public, not a secret).
--   - Calls `net.http_post` with the correct argument order
--     (url, body, headers — body is positional arg #2 in pg_net).
--   - Keeps the best-effort exception handler so a push outage never aborts
--     the originating insert (chat message, letter send, family join).
--
-- Prerequisite (manual, one-time, per environment):
--   Dashboard → Project Settings → Vault → Secrets → Add new secret
--     name:   service_role_key
--     secret: the value the edge function will see as
--             Deno.env.get('SUPABASE_SERVICE_ROLE_KEY').
--             On projects with the new sb_publishable_/sb_secret_ key
--             system, that's the `sb_secret_...` value from
--             "Publishable and secret API keys", NOT the legacy JWT from
--             "Legacy anon, service_role API keys". On legacy-only
--             projects, it's the legacy service_role JWT.
--
-- Companion change (manual, one-time, per environment):
--   Deploy the send_push edge function with `--no-verify-jwt` so Supabase's
--   edge gateway lets the sb_secret_ bearer through to function code on
--   new-key projects. The gateway rejects non-JWT bearers by default.
--
-- The trigger functions (tg_push_family_joined, tg_push_event_message,
-- tg_push_letter_delivered) call this helper by signature, so they pick up
-- the new behavior automatically. No trigger changes needed.
--
-- ROLLBACK: re-apply 20260522000017's helper definition (and accept that
-- pushes will silently no-op on hosted Supabase until this migration is
-- restored).

create or replace function public.send_push_notification(
  _user_id uuid,
  _title   text,
  _body    text,
  _url     text default '/'
)
returns void
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  -- Project URL is public — embed it. The service-role secret is the secret.
  v_url  constant text := 'https://yaogxksbhpiqmgjuuqnj.supabase.co';
  v_key  text;
  v_body jsonb;
  v_req  bigint;
begin
  -- Look up the service role secret from Vault. If the row is missing
  -- (e.g. on a fresh branch where the dashboard step wasn't done), no-op
  -- with a notice rather than raising — pushes are best-effort by design.
  select decrypted_secret
    into v_key
    from vault.decrypted_secrets
   where name = 'service_role_key'
   limit 1;

  if v_key is null or v_key = '' then
    raise notice 'send_push_notification: vault secret "service_role_key" not found; skipping. Add it via Dashboard → Project Settings → Vault.';
    return;
  end if;

  v_body := jsonb_build_object(
    'user_id', _user_id,
    'title',   _title,
    'body',    _body,
    'url',     coalesce(_url, '/')
  );

  begin
    select net.http_post(
      url     := v_url || '/functions/v1/send_push',
      body    := v_body,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
      )
    ) into v_req;
  exception
    when others then
      -- Best-effort. Never let a push failure abort a write.
      raise notice 'send_push_notification: pg_net post failed: %', sqlerrm;
  end;
end;
$$;

comment on function public.send_push_notification(uuid, text, text, text) is
  'Best-effort push notification dispatch via the send_push edge function. Reads service_role_key from Supabase Vault; project URL is embedded. Calls net.http_post (not extensions.http_post — pg_net always lives in the net schema). Silently no-ops if the Vault secret is missing.';

-- rollback
-- (Re-apply 20260522000017_push_triggers.sql's helper definition.)

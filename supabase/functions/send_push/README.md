# send_push

Edge Function that fans a notification out to every device in
`public.push_subscriptions` for a given `user_id` via the Web Push protocol
(RFC 8030, VAPID-signed).

## Deploy

```bash
# From the repo root.

# 1. Generate VAPID keys. Run this ONCE, save the output, never regenerate
#    in production (regenerating invalidates every existing subscription).
npx web-push generate-vapid-keys --json
# -> { "publicKey": "<base64url>", "privateKey": "<base64url>" }

# 2. Push the keys + subject into Supabase as secrets.
supabase secrets set \
  VAPID_PUBLIC_KEY='<paste publicKey here>' \
  VAPID_PRIVATE_KEY='<paste privateKey here>' \
  VAPID_SUBJECT='mailto:hello@famlinkapp.com'

# 3. Deploy the function. JWT verify is OFF (set in supabase/config.toml
#    under [functions.send_push]) because FamLink is on the new
#    sb_publishable_/sb_secret_ API key system — the auto-injected
#    SUPABASE_SERVICE_ROLE_KEY is an sb_secret_... string, not a JWT, and
#    the edge gateway rejects non-JWT bearers when verify is on. The
#    function still authenticates the caller itself by comparing the
#    bearer to SUPABASE_SERVICE_ROLE_KEY. See:
#    - supabase/config.toml [functions.send_push] verify_jwt = false
#    - supabase/migrations/20260522000018_push_helper_vault.sql
#    - WEB-PUSH-DEPLOY.md step 5
supabase functions deploy send_push

# 4. Expose the same publicKey to the client (Vercel env var):
#    EXPO_PUBLIC_VAPID_PUBLIC_KEY=<paste publicKey here>
#    Add it in the Vercel project settings → Environment Variables.
#    Redeploy the Vercel site afterwards so the new value bakes into the bundle.
```

## How it's called

- **From Postgres triggers** (`20260522000017_push_triggers.sql` defines the
  triggers; `20260522000018_push_helper_vault.sql` defines the helper) — via
  `net.http_post` using the Vault-stored service role secret as the bearer.
  This is the primary code path.
- **From the client** (rare; used for test pings) — with the signed-in user's
  JWT. The function only allows the user to send to themselves in that case.
  Note: on new-key projects, the client must still send a valid JWT (i.e. the
  user's access token), not a `sb_secret_` value.

## Body schema

```json
{
  "user_id": "<uuid>",
  "title":   "string",
  "body":    "string",
  "url":     "/optional/path"
}
```

The function returns `{ ok, sent, removed, failures }`. `removed` reflects
subscriptions that returned HTTP 404 or 410 (Gone) — those are pruned from
the table automatically.

## Test

Prefer the SQL helper — it's the same path a real trigger takes:

```sql
select public.send_push_notification(
  (select id from auth.users where email = '<you@example.com>'),
  'FamLink',
  'Test push',
  '/'
);

-- wait a second for pg_net to process, then:
select status_code, content, created
from net._http_response
order by created desc
limit 1;
```

200 + your device pings = success. Non-200 troubleshooting in
[WEB-PUSH-DEPLOY.md](../../../WEB-PUSH-DEPLOY.md) step 8.

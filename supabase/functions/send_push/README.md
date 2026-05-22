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

# 3. Deploy the function.
supabase functions deploy send_push

# 4. Expose the same publicKey to the client (Vercel env var):
#    EXPO_PUBLIC_VAPID_PUBLIC_KEY=<paste publicKey here>
#    Add it in the Vercel project settings → Environment Variables.
#    Redeploy the Vercel site afterwards so the new value bakes into the bundle.
```

## How it's called

- **From Postgres triggers** (`20260522000017_push_triggers.sql`) — via
  `pg_net.http_post` using the SERVICE_ROLE_KEY as the bearer. This is the
  primary code path.
- **From the client** (rare; used for test pings) — with the signed-in user's
  JWT. The function only allows the user to send to themselves in that case.

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

## Local test

```bash
# After deploy, with the user already signed in on famlinkapp.com:
curl -X POST "$SUPABASE_URL/functions/v1/send_push" \
  -H "Authorization: Bearer $SUPABASE_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<your-uuid>",
    "title": "FamLink test",
    "body": "If you see this, push works.",
    "url": "/"
  }'
```

# Web Push Notifications — Deploy Guide

End-to-end web push for FamLink (famlinkapp.com). After running every step
below, three events trigger pushes:

1. Family member joined → inviter gets pinged.
2. New chat in an event → every other event member gets pinged.
3. Letter delivered → recipient gets pinged.

Works on iOS 16.4+ (PWA installed to home screen), Android Chrome, and
desktop Chrome/Edge/Firefox.

---

## 0. Prerequisites

- Supabase CLI logged in and linked to the production project.
- Vercel CLI (or dashboard access) for the env var step.
- A throwaway iOS device running 16.4+ (or an Android phone) to verify.

---

## 1. Generate VAPID keys (one time, never regenerate)

Regenerating VAPID keys invalidates every existing subscription. Do this
once and stash the keys in a password manager.

```bash
npx web-push generate-vapid-keys --json
```

Output looks like:

```json
{
  "publicKey": "BJ8L4...long base64url string...",
  "privateKey": "kQp2y...shorter base64url string..."
}
```

Copy both into a safe place.

---

## 2. Set Supabase secrets

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY='<paste publicKey>' \
  VAPID_PRIVATE_KEY='<paste privateKey>' \
  VAPID_SUBJECT='mailto:hello@famlinkapp.com'
```

Verify:

```bash
supabase secrets list | grep VAPID
```

---

## 3. Store the service role secret in Supabase Vault

The trigger helper `public.send_push_notification` reads the service role
secret from Supabase Vault so it can call the `send_push` Edge Function.
The project URL is hardcoded in the migration (it's public, not a secret).

> Why Vault and not Postgres GUCs? Hosted Supabase blocks the `postgres`
> role from running `ALTER DATABASE ... SET app.settings.*` (error 42501).
> The old GUC instructions silently failed — the helper hit its no-op
> branch on every trigger and no push ever went out. Migration
> `20260522000018_push_helper_vault.sql` moved the read to Vault to work
> around this.

**Which key to paste — depends on your project's key system:**

- **New-key projects (Publishable / Secret keys enabled — FamLink is one):**
  Use the value from Project Settings → API → **Publishable and secret
  API keys** tab → `sb_secret_...`. This is what gets auto-injected as
  `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` inside the edge function on
  these projects.
- **Legacy-only projects:** Use the legacy `service_role` JWT from the
  "Legacy anon, service_role API keys" tab.

The bearer the trigger sends and the env var the edge function compares
against must match exactly. Mismatch = silent 401 from the function.

One-time setup, done in the dashboard:

1. Project Settings → **Vault** → **Secrets** → **Add new secret**.
2. Name: `service_role_key` (exact spelling — the SQL function looks it up by name).
3. Secret: paste the correct key per the rules above.
4. Description: anything useful, e.g. `Used by send_push_notification to call the send_push edge function`.
5. Save.

Verify:

```sql
select name, created_at
  from vault.decrypted_secrets
 where name = 'service_role_key';
```

If you get one row, you're good. The migration also hardcodes the project URL
to `https://yaogxksbhpiqmgjuuqnj.supabase.co` — if you ever move projects,
update the `v_url` constant in `20260522000018_push_helper_vault.sql`.

---

## 4. Apply the migrations

Two new migrations:

```bash
supabase db push
```

This applies:

- `20260522000016_push_subscriptions.sql` — the table + RLS.
- `20260522000017_push_triggers.sql` — the helper + three triggers.

The trigger migration `CREATE EXTENSION IF NOT EXISTS pg_net`. On hosted
Supabase that extension is pre-installed. If `pg_net` somehow isn't
available, the migration will still apply but pushes will silently no-op
(see the `raise notice` paths in the helper function); replace with a
Supabase Database Webhook configured from the dashboard pointing at
`https://<ref>.supabase.co/functions/v1/send_push`.

---

## 5. Deploy the edge function

```bash
supabase functions deploy send_push
```

`supabase/config.toml` has `[functions.send_push] verify_jwt = false`, so the
CLI sends the function up with JWT verification disabled at Supabase's edge
gateway — required on new-key projects because `sb_secret_...` isn't a JWT
and the gateway would otherwise reject it as `UNAUTHORIZED_INVALID_JWT_FORMAT`
before our function code runs. The function still authenticates the caller
itself by comparing the bearer to `SUPABASE_SERVICE_ROLE_KEY`.

If you ever deploy without that config (e.g. via the dashboard's code
editor, which ignores config.toml), redeploy with the flag explicitly:

```bash
supabase functions deploy send_push --no-verify-jwt
```

Verify in the dashboard → Edge Functions → send_push is deployed and that
its "Verify JWT" toggle reads OFF.

---

## 6. Add the public key as a Vercel env var

The client needs the VAPID public key to subscribe with the correct
`applicationServerKey`.

1. Vercel dashboard → famlink project → Settings → Environment Variables.
2. Add `EXPO_PUBLIC_VAPID_PUBLIC_KEY` with the **public** key from step 1.
   Scope: Production + Preview + Development.
3. Trigger a redeploy of the latest commit so the new value bakes into the
   bundle (env changes alone don't redeploy).

---

## 7. Verify on a phone

iOS 16.4+:

1. Open famlinkapp.com in Safari.
2. Tap Share → Add to Home Screen → Add.
3. Open FamLink from the home-screen icon (must launch from there — Safari
   tabs can't receive push on iOS).
4. Sign in. Wait ~5 seconds. The soft-ask modal should appear.
5. Tap "Turn on notifications". Allow at the OS prompt.
6. As a second user, sign up via your invite link, or send the test user a
   letter. Watch the iOS notification land.

Android Chrome:

1. Open famlinkapp.com.
2. Chrome may prompt "Install app" — accept (optional, push works without
   install on Android).
3. After ~5 seconds in the PWA, accept the notifications prompt.
4. Same test as above.

---

## 8. Sanity check the data path

The canonical end-to-end test goes through the SQL helper, which is the
same code path every trigger uses. Run in the Supabase SQL editor:

```sql
select public.send_push_notification(
  (select id from auth.users where email = '<you@example.com>'),
  'FamLink',
  'If you see this, push works.',
  '/'
);
```

Then immediately:

```sql
select status_code, content, created
from net._http_response
order by created desc
limit 1;
```

Expected: `status_code = 200`, `content = {"ok":true,"sent":1,"removed":0,"failures":[]}`,
and your device pings within ~2 seconds.

Common non-200 cases:

- **`401` with `UNAUTHORIZED_INVALID_JWT_FORMAT`** — `send_push` was deployed
  with JWT verify ON. Redeploy with `--no-verify-jwt` (see step 5).
- **`401` with `{"ok":false,"error":"Not authorized"}`** — the Vault secret
  doesn't match `SUPABASE_SERVICE_ROLE_KEY` in the edge function. Re-check
  step 3 (the right key depends on whether this is a new-key project).
- **`200` with `"sent":0` and `"note":"no subscriptions for user"`** — the
  target user has no push_subscriptions row. Open the PWA on a device,
  accept the prompt, and try again.

`removed` = subscriptions pruned because the push service returned 410 Gone
(stale device). It's normal to see >0 once devices expire.

---

## 9. Roll back

If something is wrong and you need to disable pushes fast:

```sql
-- Disable triggers without dropping anything (revert later by re-enabling):
alter table public.family_memberships disable trigger family_memberships_push_trg;
alter table public.event_messages     disable trigger event_messages_push_trg;
alter table public.letters            disable trigger letters_push_trg;
```

To fully revert, see the `-- rollback` sections at the bottom of each
migration.

---

## Notes / decisions

- **Trigger transport:** chose `pg_net.http_post` over a Database Webhook
  because triggers can be provisioned by migration (webhooks need
  dashboard configuration that can drift).
- **Per-user fan-out happens in the edge function**, not the trigger — keeps
  the Postgres trigger fast and the retry/error logic in TypeScript.
- **No service-worker caching.** FamLink is online-first; we may add a real
  offline strategy later, but mixing push + caching now would risk shipped
  fixes not reaching users.
- **iOS 16.4 floor is documented in onboarding/install.tsx** so users on
  older iOS see why no notifications arrive.

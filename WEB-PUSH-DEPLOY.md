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

## 3. Set Postgres GUCs for the triggers

The trigger functions read the Supabase URL + service role key from project
settings (GUCs) so they can fan out to the `send_push` Edge Function. Run
these in the SQL editor (Dashboard → SQL → New query) as the project owner:

```sql
alter database postgres set app.settings.supabase_url
  = 'https://<your-project-ref>.supabase.co';
alter database postgres set app.settings.service_role_key
  = '<your service role key>';
```

These persist across sessions. To verify:

```sql
select current_setting('app.settings.supabase_url', true),
       current_setting('app.settings.service_role_key', true) is not null as has_key;
```

(If either is null after these commands, you ran them in a session that
hasn't been reloaded — issue `select pg_reload_conf();` and re-test from a
fresh SQL editor tab.)

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

Verify in the dashboard → Edge Functions → send_push is deployed.

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

```bash
# As the signed-in user, fire a test push to yourself:
curl -X POST "https://<ref>.supabase.co/functions/v1/send_push" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<your uuid>",
    "title": "FamLink test",
    "body": "If you see this, push works.",
    "url": "/"
  }'
```

Expected response: `{"ok":true,"sent":1,"removed":0,"failures":[]}`.

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

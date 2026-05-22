# `send_sms_invite` Edge Function

Sends a Twilio SMS invite to a phone number, embedding the active
`family_invite_links` token for the caller's circle. Writes every attempt
to `public.sms_invite_log` for auditing and rate-limiting.

## What it does

1. Verifies the caller's JWT.
2. Confirms the caller is an `admin` member of `circle_id`.
3. Enforces a rolling rate limit (**10 SMS / hour / user**).
4. Looks up the active invite link, or mints one via the
   `regenerate_family_invite(_circle_id)` RPC.
5. Normalizes the phone number to E.164 (`+1` defaulted for 10-digit US
   numbers; rejects malformed input).
6. POSTs to the Twilio Messages API.
7. Records the attempt in `sms_invite_log` (`queued` → `sent` | `failed`).

## Request

```http
POST /functions/v1/send_sms_invite
Authorization: Bearer <user JWT>
Content-Type: application/json

{
  "phone": "(555) 123-4567",
  "circle_id": "uuid",
  "recipient_name": "Mom"          // optional
}
```

## Response

Success:
```json
{ "ok": true, "sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

Failure:
```json
{ "ok": false, "error": "human-readable message" }
```

HTTP status:
- `400` validation failures
- `401` missing/invalid JWT
- `403` not an admin of the circle
- `429` rate limit exceeded (10 / hour)
- `502` Twilio rejected the send
- `503` Twilio env not configured

## Required secrets

Set these in **Supabase Dashboard → Project → Edge Functions → Secrets**
(or via `supabase secrets set ...`):

| Secret | Where it comes from |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info → Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info → Auth Token (the live one, not test) |
| `TWILIO_PHONE_NUMBER` | The Twilio number you bought, in E.164 (e.g. `+15555550123`) |

The following are injected automatically by Supabase and do **not** need
to be set manually:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy

```bash
# From repo root
supabase functions deploy send_sms_invite

# Set secrets (one-time)
supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  TWILIO_PHONE_NUMBER=+15555550123
```

## Test locally

```bash
supabase functions serve send_sms_invite --env-file ./supabase/.env.local
```

Then `curl` it with a valid user JWT in the `Authorization` header.

## Related schema

- `public.family_invite_links` (migration `20260522000004_family_invite_links.sql`)
- `public.sms_invite_log` (migration `20260522000007_sms_invite_log.sql`)
- RPCs: `regenerate_family_invite(_circle_id)` and `claim_family_invite(_token)`

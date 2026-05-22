# Stripe Subscriptions — Deploy Guide

End-to-end Stripe subscriptions for FamLink (famlinkapp.com).

Pricing: **$19.99/year per user**, single Stripe Subscription, with a
**Friends & Family launch** toggle (`EXPO_PUBLIC_PAYWALL_ENABLED`) that ships
**off** — meaning nothing is gated, and `/billing` is purely opt-in. Anyone
can claim a free Friends & Family year with one tap; anyone who *wants* to
pay can go through Stripe Checkout.

---

## 0. Prerequisites

- Supabase CLI logged in and linked to the production project.
- Vercel CLI (or dashboard access) for the env-var step.
- A Stripe account (test mode is fine for the soft launch).

---

## 1. Stripe dashboard setup

1. Sign in (or sign up) at https://stripe.com. Keep the dashboard in **Test
   mode** while we soft-launch — the toggle is top-right.
2. **Create the product**: Products → Add product →
   - Name: `FamLink Annual`
   - Description: `One year of full FamLink access.`
   - Pricing: Recurring, USD 19.99, **Yearly**
3. After saving, click into the price and copy the **Price ID**. It looks
   like `price_1Q...` — that's `STRIPE_PRICE_ID` everywhere below.
4. **API keys**: Developers → API keys.
   - Copy the publishable key (`pk_test_...` or `pk_live_...`).
   - Reveal and copy the secret key (`sk_test_...` or `sk_live_...`). Store
     it in a password manager — Stripe only shows it once after rotation.
5. **Billing portal** (optional but recommended): Settings → Billing → Customer
   portal. Enable it and configure what users can do (typically: update card,
   cancel subscription). Save changes.

We'll come back to Stripe for the webhook endpoint in step 4.

---

## 2. Set Supabase secrets

Run with placeholders replaced. Use the test keys for soft launch:

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_PRICE_ID=price_xxx \
  FAMLINK_APP_URL=https://famlinkapp.com
```

`STRIPE_WEBHOOK_SECRET` comes in step 4 — we don't have it yet because the
endpoint hasn't been created.

Verify:

```bash
supabase secrets list | grep STRIPE
```

---

## 3. Apply the migration and deploy the edge functions

Migration `20260522000018_subscriptions.sql` adds:

- Five subscription columns + the `stripe_customer_id` unique partial index
  on `public.profiles`.
- The `stripe_webhook_events` idempotency table.
- The `mark_f_and_f()` RPC.

```bash
supabase db push
supabase functions deploy stripe_create_checkout stripe_webhook stripe_create_portal
```

**Important**: in the Supabase dashboard → Edge Functions →
**stripe_webhook** → Details, set **Verify JWT = OFF**. Stripe's webhook
posts don't carry a Supabase JWT; the function authenticates them via the
`Stripe-Signature` header instead.

---

## 4. Register the webhook with Stripe

1. Stripe dashboard → Developers → Webhooks → **Add endpoint**.
2. Endpoint URL:
   ```
   https://yaogxksbhpiqmgjuuqnj.supabase.co/functions/v1/stripe_webhook
   ```
3. Events to listen for (search and select each one):
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Save. Click into the new endpoint → **Reveal signing secret**. Copy the
   `whsec_...` string.
5. Push that to Supabase:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

(Re-running `set` adds/updates one secret without touching the others.)

The webhook secret rotates if you delete-and-recreate the endpoint, so write
this command into the password manager too.

---

## 5. Add env vars to Vercel

The client needs to know which Price to checkout against and whether the
paywall is on. Both are `EXPO_PUBLIC_` so Expo bakes them into the bundle.

1. Vercel dashboard → famlink project → Settings → Environment Variables.
2. Add (Production + Preview + Development scope on both):
   - `EXPO_PUBLIC_STRIPE_PRICE_ID` = `price_xxx`
   - `EXPO_PUBLIC_PAYWALL_ENABLED` = `false`
3. Redeploy the latest commit so the new values bake into the JS bundle.
   Env changes alone don't redeploy.

When we're ready to actually paywall things, flip
`EXPO_PUBLIC_PAYWALL_ENABLED` to `true` and redeploy. Today (`false`):

- `/billing` is purely opt-in.
- `paywall_active` is always `false` on the home screen, so the nudge
  banner never appears.
- Nothing else in the app is gated.

---

## 6. Verify end-to-end (test mode)

1. Open famlinkapp.com → sign in.
2. Navigate to **Profile** → tap the new "Membership" row → lands on
   `/billing`.
3. **Path A — Friends & Family**: tap "Activate Free — Friends & Family".
   The CTA flips to a "You're in!" card. Check Supabase:
   ```sql
   select user_id, subscription_status, subscription_tier
     from public.profiles
    where user_id = '<your uuid>';
   ```
   Expect `f_and_f` / `Friends & Family`.
4. **Path B — paid**: from a different test account, tap "Or pay $19.99/year
   to support". Use Stripe's test card `4242 4242 4242 4242`, any future
   expiry, any CVC, any postcode. Complete checkout — you land on
   `/billing?ok=1` and see the green "subscribed" toast.
5. Confirm the webhook fired: Stripe dashboard → Developers → Webhooks →
   your endpoint → Recent deliveries → status 200. Cross-check Supabase:
   `subscription_status` should now be `active`, `subscription_tier =
   Annual`, and `stripe_customer_id` + `stripe_subscription_id` populated.
6. Tap "Manage subscription" → the Stripe Billing Portal opens. Cancel the
   sub from there to test the `customer.subscription.deleted` → `canceled`
   path. Profile flips to `canceled`; UI shows the "Update payment method"
   recovery banner.

---

## 7. Going live

When you're ready to take real money:

1. Stripe dashboard → flip to **Live mode** (top-right toggle).
2. Re-create the product + price in live mode. Copy the new `price_live_...`.
3. Generate live API keys (`sk_live_...`). Rotate test keys out:
   ```bash
   supabase secrets set \
     STRIPE_SECRET_KEY=sk_live_xxx \
     STRIPE_PRICE_ID=price_live_xxx
   ```
4. Re-register the webhook endpoint in live mode (same URL, same events).
   Copy the new `whsec_...` and:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_xxx
   ```
5. Update `EXPO_PUBLIC_STRIPE_PRICE_ID` in Vercel to the live price id.
   Redeploy.
6. When you actually want to start gating: set `EXPO_PUBLIC_PAYWALL_ENABLED`
   to `true` in Vercel and redeploy.

---

## 8. Roll back

Disable Stripe writes without dropping anything (revert later):

```sql
-- Pause F&F activations:
revoke execute on function public.mark_f_and_f() from authenticated;
```

Or fully revert: see the `-- rollback` block at the bottom of
`supabase/migrations/20260522000018_subscriptions.sql`.

---

## Notes / decisions

- **One Stripe Customer per FamLink user.** We don't share customers across
  family members — each signed-in user pays for their own seat. The
  customer is created lazily on first checkout (or first F&F activation
  that promotes to paid later).
- **Webhook is the only writer for paid statuses.** The mark_f_and_f() RPC
  is the only writer for the f_and_f tier. Clients never write subscription
  columns directly.
- **Idempotency on the webhook side.** Every event.id is logged to
  `stripe_webhook_events`. Stripe retries on 5xx, so a duplicate delivery
  short-circuits before touching profiles.
- **`client_reference_id` belt + customer.metadata suspenders.** We attribute
  the checkout to a Supabase user via the session's `client_reference_id`
  AND via the customer/subscription metadata. Either survives if the other
  ever goes missing.
- **Raw body for signature verification.** Stripe signs the byte stream —
  `req.text()` gives us that, and we pass it untouched to
  `stripe.webhooks.constructEventAsync`. Parsing first would break the
  signature check.
- **No App Store / Play Store IAP.** FamLink is a PWA; payments go through
  Stripe Checkout. If we ever ship native binaries, we'll have to revisit.

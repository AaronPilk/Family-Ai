// Edge Function: stripe_webhook
// =============================================================================
// Receives Stripe webhook events, verifies the signature against the
// STRIPE_WEBHOOK_SECRET, then updates the profile row for the affected user.
//
// Idempotency: every event.id is recorded in public.stripe_webhook_events
// before we touch a profile. A retry of the same event short-circuits.
//
// Events handled (configure these on the Stripe endpoint):
//   - checkout.session.completed
//   - customer.subscription.updated
//   - customer.subscription.deleted
//   - invoice.payment_failed
//
// Signature verification MUST be done against the *raw* request body. We read
// `req.text()` and pass that exact string to stripe.webhooks.constructEventAsync
// (the async variant uses Web Crypto, which works in Deno). Do NOT re-stringify
// parsed JSON — the byte-for-byte body is what Stripe signed.
//
// Required Supabase secrets:
//   - STRIPE_SECRET_KEY           — sk_test_xxx or sk_live_xxx
//   - STRIPE_WEBHOOK_SECRET       — whsec_xxx from the Stripe endpoint
//   - SUPABASE_URL                (auto-provided)
//   - SUPABASE_SERVICE_ROLE_KEY   (auto-provided)
//
// IMPORTANT: in Supabase dashboard → Edge Functions → stripe_webhook → Details,
// disable "Verify JWT". Stripe's webhook calls are unauthenticated by JWT and
// instead carry the Stripe-Signature header.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@^14';

const CORS_HEADERS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

const JSON_HEADERS: HeadersInit = {
  'content-type': 'application/json',
  ...CORS_HEADERS,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function fail(error: string, status = 400): Response {
  return jsonResponse({ ok: false, error }, status);
}

interface PaidStatus {
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled';
  subscription_tier: string;
  subscription_current_period_end: string | null;
  subscription_marked_at: string;
  stripe_subscription_id: string | null;
}

function tierLabelFromStatus(status: PaidStatus['subscription_status']): string {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'Annual';
    case 'past_due':
      return 'Annual (past due)';
    case 'canceled':
      return 'Canceled';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return fail('Server misconfigured: Supabase env missing', 500);
  }
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return fail('Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.', 503);
  }

  // --- Read raw body + verify signature --------------------------------------
  // Stripe signs the exact byte stream of the request body. We MUST pass the
  // raw string (not re-stringified JSON) to constructEventAsync.
  const rawBody = await req.text();
  const sigHeader = req.headers.get('stripe-signature') ?? '';
  if (!sigHeader) return fail('Missing stripe-signature header', 400);

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Signature verification failed';
    // eslint-disable-next-line no-console
    console.warn('[stripe_webhook] signature verification failed:', msg);
    return fail(`Signature verification failed: ${msg}`, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Idempotency: skip duplicate event.ids ---------------------------------
  const { data: existingEvent } = await admin
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existingEvent) {
    return jsonResponse({ ok: true, duplicate: true, event_id: event.id });
  }

  // --- Dispatch --------------------------------------------------------------
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripe, admin, event);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        await handleSubscriptionUpdated(admin, event);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(admin, event);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(stripe, admin, event);
        break;
      default:
        // Unhandled event type. Still record it so duplicate deliveries
        // short-circuit, but otherwise no-op.
        break;
    }
  } catch (e) {
    // Surface the error to Stripe so it retries. Do NOT insert the
    // idempotency row — we want the retry to actually retry the work.
    const msg = e instanceof Error ? e.message : 'webhook handler failed';
    // eslint-disable-next-line no-console
    console.error('[stripe_webhook] handler error:', msg);
    return fail(`Webhook handler failed: ${msg}`, 500);
  }

  // --- Record the event so retries are no-ops --------------------------------
  await admin.from('stripe_webhook_events').insert({
    event_id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  return jsonResponse({ ok: true, event_id: event.id, type: event.type });
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  stripe: Stripe,
  admin: ReturnType<typeof createClient>,
  event: Stripe.Event,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!customerId) return;

  // Attribute back to Supabase user. Prefer client_reference_id, fall back to
  // customer.metadata.supabase_user_id.
  let userId = (session.client_reference_id ?? null) as string | null;
  if (!userId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!('deleted' in customer && customer.deleted)) {
        userId = (customer.metadata?.supabase_user_id as string | undefined) ?? null;
      }
    } catch {
      // fall through
    }
  }
  if (!userId) {
    // Last resort: lookup by stripe_customer_id (only works if a previous
    // checkout already persisted it).
    const { data } = await admin
      .from('profiles')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    userId = (data?.user_id as string | undefined) ?? null;
  }
  if (!userId) {
    // eslint-disable-next-line no-console
    console.warn('[stripe_webhook] checkout.session.completed: could not attribute to user', {
      session_id: session.id,
      customer: customerId,
    });
    return;
  }

  // Look up the full subscription so we get the real status + period end.
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  let status: PaidStatus['subscription_status'] = 'active';
  let currentPeriodEnd: string | null = null;
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      status = normalizeSubStatus(sub.status);
      currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;
    } catch {
      // keep defaults
    }
  }

  await applyPaidStatus(admin, userId, {
    stripe_subscription_id: subscriptionId ?? null,
    subscription_status: status,
    subscription_tier: tierLabelFromStatus(status),
    subscription_current_period_end: currentPeriodEnd,
    subscription_marked_at: new Date().toISOString(),
  }, customerId);
}

async function handleSubscriptionUpdated(
  admin: ReturnType<typeof createClient>,
  event: Stripe.Event,
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = await findUserIdByCustomer(admin, customerId, sub);
  if (!userId) return;

  const status = normalizeSubStatus(sub.status);
  await applyPaidStatus(admin, userId, {
    stripe_subscription_id: sub.id,
    subscription_status: status,
    subscription_tier: tierLabelFromStatus(status),
    subscription_current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    subscription_marked_at: new Date().toISOString(),
  }, customerId);
}

async function handleSubscriptionDeleted(
  admin: ReturnType<typeof createClient>,
  event: Stripe.Event,
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = await findUserIdByCustomer(admin, customerId, sub);
  if (!userId) return;

  await applyPaidStatus(admin, userId, {
    stripe_subscription_id: sub.id,
    subscription_status: 'canceled',
    subscription_tier: 'Canceled',
    subscription_current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    subscription_marked_at: new Date().toISOString(),
  }, customerId);
}

async function handleInvoicePaymentFailed(
  stripe: Stripe,
  admin: ReturnType<typeof createClient>,
  event: Stripe.Event,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;

  const userId = await findUserIdByCustomer(admin, customerId);
  if (!userId) return;

  let currentPeriodEnd: string | null = null;
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;
    } catch {
      // ignore
    }
  }

  await applyPaidStatus(admin, userId, {
    stripe_subscription_id: subscriptionId ?? null,
    subscription_status: 'past_due',
    subscription_tier: 'Annual (past due)',
    subscription_current_period_end: currentPeriodEnd,
    subscription_marked_at: new Date().toISOString(),
  }, customerId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSubStatus(
  s: Stripe.Subscription.Status,
): PaidStatus['subscription_status'] {
  switch (s) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    case 'incomplete':
    case 'paused':
    default:
      // Treat in-between states as past_due so the UI nudges to fix payment.
      return 'past_due';
  }
}

async function findUserIdByCustomer(
  admin: ReturnType<typeof createClient>,
  customerId: string,
  sub?: Stripe.Subscription,
): Promise<string | null> {
  // Try profile lookup first.
  const { data } = await admin
    .from('profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (data?.user_id) return data.user_id as string;

  // Fall back to subscription.metadata.supabase_user_id (we set it on create).
  const metaUserId = sub?.metadata?.supabase_user_id;
  if (metaUserId && typeof metaUserId === 'string') return metaUserId;

  // eslint-disable-next-line no-console
  console.warn('[stripe_webhook] could not attribute customer to user', { customerId });
  return null;
}

async function applyPaidStatus(
  admin: ReturnType<typeof createClient>,
  userId: string,
  status: PaidStatus,
  customerId: string,
): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: status.stripe_subscription_id,
      subscription_status: status.subscription_status,
      subscription_tier: status.subscription_tier,
      subscription_current_period_end: status.subscription_current_period_end,
      subscription_marked_at: status.subscription_marked_at,
    })
    .eq('user_id', userId);
  if (error) {
    throw new Error(`profile update failed: ${error.message}`);
  }
}

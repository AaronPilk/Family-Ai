// Edge Function: stripe_create_checkout
// =============================================================================
// Creates (or reuses) the calling user's Stripe Customer and starts a Stripe
// Checkout Session in subscription mode for the FamLink annual price. Returns
// `{ url }` for the client to redirect to.
//
// Request body: none required. We identify the user from the bearer token.
//
// Required Supabase secrets (set via `supabase secrets set`):
//   - STRIPE_SECRET_KEY  — sk_test_xxx or sk_live_xxx
//   - STRIPE_PRICE_ID    — price_xxx for the FamLink Annual price
//   - FAMLINK_APP_URL    — https://famlinkapp.com (no trailing slash)
//   - SUPABASE_URL                (auto-provided)
//   - SUPABASE_SERVICE_ROLE_KEY   (auto-provided)
//   - SUPABASE_ANON_KEY           (auto-provided)
//
// Returns 200 { url } on success, 4xx { ok: false, error } otherwise.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@^14';

const CORS_HEADERS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
  const STRIPE_PRICE_ID = Deno.env.get('STRIPE_PRICE_ID');
  const FAMLINK_APP_URL = Deno.env.get('FAMLINK_APP_URL') ?? 'https://famlinkapp.com';

  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return fail('Server misconfigured: Supabase env missing', 500);
  }
  if (!STRIPE_SECRET_KEY) {
    return fail(
      'Stripe is not configured. Set STRIPE_SECRET_KEY via `supabase secrets set`.',
      503,
    );
  }
  if (!STRIPE_PRICE_ID) {
    return fail(
      'Stripe price is not configured. Set STRIPE_PRICE_ID via `supabase secrets set`.',
      503,
    );
  }

  // --- Caller auth -----------------------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!bearer) return fail('Not authorized', 401);

  const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResp, error: userErr } = await authedClient.auth.getUser();
  if (userErr || !userResp?.user) return fail('Not authorized', 401);
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? undefined;

  // --- Look up the profile so we can reuse stripe_customer_id ----------------
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('user_id, display_name, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profErr) {
    return fail(`Could not load profile: ${profErr.message}`, 500);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

  // --- Create-or-reuse Customer ----------------------------------------------
  let customerId = profile?.stripe_customer_id as string | null | undefined;
  if (!customerId) {
    try {
      const customer = await stripe.customers.create({
        email: userEmail,
        name: (profile?.display_name as string | undefined) ?? undefined,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      const { error: updErr } = await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', userId);
      if (updErr) {
        // Non-fatal: we can still complete checkout. Webhook will retry the
        // attribution via client_reference_id below.
        // eslint-disable-next-line no-console
        console.warn('[stripe_create_checkout] failed to persist customer id:', updErr.message);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create Stripe customer';
      return fail(msg, 500);
    }
  }

  // --- Create Checkout Session -----------------------------------------------
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId!,
      // client_reference_id is the belt-and-suspenders backup for the webhook
      // attributing the resulting subscription to a Supabase user even if the
      // customer.metadata round-trip ever fails.
      client_reference_id: userId,
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${FAMLINK_APP_URL}/billing?ok=1`,
      cancel_url: `${FAMLINK_APP_URL}/billing?cancel=1`,
      subscription_data: {
        metadata: { supabase_user_id: userId },
      },
    });

    if (!session.url) return fail('Stripe returned no checkout URL', 500);
    return jsonResponse({ ok: true, url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to start checkout';
    return fail(msg, 500);
  }
});

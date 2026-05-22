// Edge Function: stripe_create_portal
// =============================================================================
// Returns a Stripe Billing Portal URL for the calling user. The user must have
// a stripe_customer_id on their profile (i.e., they've checked out at least
// once). Used by the "Manage subscription" CTA on /billing.
//
// Required Supabase secrets:
//   - STRIPE_SECRET_KEY  — sk_test_xxx or sk_live_xxx
//   - FAMLINK_APP_URL    — https://famlinkapp.com (no trailing slash)
//   - SUPABASE_URL                (auto-provided)
//   - SUPABASE_SERVICE_ROLE_KEY   (auto-provided)
//   - SUPABASE_ANON_KEY           (auto-provided)

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

  // --- Look up the customer id ----------------------------------------------
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profErr) return fail(`Could not load profile: ${profErr.message}`, 500);
  const customerId = profile?.stripe_customer_id as string | null | undefined;
  if (!customerId) {
    return fail('No Stripe customer yet — start a checkout first.', 409);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FAMLINK_APP_URL}/billing`,
    });
    if (!session.url) return fail('Stripe returned no portal URL', 500);
    return jsonResponse({ ok: true, url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to open billing portal';
    return fail(msg, 500);
  }
});

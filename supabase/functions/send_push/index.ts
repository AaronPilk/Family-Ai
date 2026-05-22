// Edge Function: send_push
// =============================================================================
// Fan a single notification out to every push_subscriptions row for a user via
// the Web Push protocol (RFC 8030 + VAPID).
//
// Call from:
//   - Postgres triggers via pg_net (the canonical caller — see
//     20260522000017_push_triggers.sql).
//   - Manually from the client for testing.
//
// Request body:
//   {
//     "user_id": "<uuid>",
//     "title":   "string",
//     "body":    "string",
//     "url":     "optional path like '/letters/abc'"
//   }
//
// Required env (Supabase Dashboard → Edge Functions → Secrets):
//   - SUPABASE_URL                (auto-provided)
//   - SUPABASE_SERVICE_ROLE_KEY   (auto-provided)
//   - VAPID_PUBLIC_KEY            (base64url, no padding)
//   - VAPID_PRIVATE_KEY           (base64url, no padding)
//   - VAPID_SUBJECT               (mailto: or https: URL identifying us)
//
// Caller auth: we accept either:
//   - The service-role JWT (Postgres triggers will pass this — see the helper
//     SQL function `public.send_push_notification` in the trigger migration).
//   - A regular user JWT, in which case the caller can only send to themselves.
//     Useful for client-side test pings without exposing the service key.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import webpush from 'npm:web-push@3.6.7';

interface RequestBody {
  user_id?: string;
  title?: string;
  body?: string;
  url?: string;
}

interface PushRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
  const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
  const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT');

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return fail('Server misconfigured: Supabase env missing', 500);
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return fail(
      'VAPID is not configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT via `supabase secrets set`.',
      503,
    );
  }

  // Parse body.
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return fail('Invalid JSON body');
  }
  const { user_id: userId, title, body: messageBody, url } = body;
  if (!userId || typeof userId !== 'string') return fail('user_id is required');
  if (!title || typeof title !== 'string') return fail('title is required');
  if (typeof messageBody !== 'string') return fail('body is required (can be empty string)');

  // --- Caller auth -----------------------------------------------------------
  // Accept either service-role bearer token (triggers) or a logged-in user
  // calling for themselves (client-side test).
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  let authorized = false;
  if (bearer && bearer === SERVICE_ROLE) {
    authorized = true;
  } else if (bearer && ANON_KEY) {
    const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userResp } = await authedClient.auth.getUser();
    if (userResp?.user?.id === userId) {
      authorized = true;
    }
  }
  if (!authorized) {
    return fail('Not authorized', 401);
  }

  // --- Configure web-push ----------------------------------------------------
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Look up the user's subscriptions --------------------------------------
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (subErr) {
    return fail(`Could not load subscriptions: ${subErr.message}`, 500);
  }
  const rows = (subs ?? []) as PushRow[];
  if (rows.length === 0) {
    return jsonResponse({ ok: true, sent: 0, removed: 0, note: 'no subscriptions for user' });
  }

  const payload = JSON.stringify({
    title,
    body: messageBody,
    url: url ?? '/',
  });

  let sent = 0;
  let removed = 0;
  const failures: { endpoint: string; status?: number; error: string }[] = [];

  await Promise.all(
    rows.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(subscription, payload, { TTL: 60 * 60 * 24 });
        sent += 1;
        await admin
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (e) {
        const err = e as { statusCode?: number; body?: unknown; message?: string };
        const status = err?.statusCode;
        // 404 or 410 = subscription is dead, prune it.
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id);
          removed += 1;
        } else {
          failures.push({
            endpoint: sub.endpoint,
            status,
            error: err?.message ?? 'unknown',
          });
        }
      }
    }),
  );

  return jsonResponse({ ok: true, sent, removed, failures });
});

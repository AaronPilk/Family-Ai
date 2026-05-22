// Edge Function: send_sms_invite
// Trigger: invoked by the client from the /invite screen.
//
// Responsibility:
//   1. Verify the caller is authenticated (via the Authorization: Bearer JWT).
//   2. Verify the caller is an admin of the target `circle_id`.
//   3. Enforce a rolling rate limit (10 SMS / hour / user).
//   4. Fetch or mint the active family_invite_links row for the circle.
//   5. Normalize the recipient phone to E.164 (US-biased).
//   6. POST to the Twilio REST API with Basic Auth.
//   7. Audit the attempt in sms_invite_log (queued → sent | failed).
//
// Required env (Supabase Dashboard → Edge Functions → Secrets):
//   - SUPABASE_URL                (auto-provided)
//   - SUPABASE_ANON_KEY           (auto-provided)
//   - SUPABASE_SERVICE_ROLE_KEY   (auto-provided)
//   - TWILIO_ACCOUNT_SID
//   - TWILIO_AUTH_TOKEN
//   - TWILIO_PHONE_NUMBER         (E.164, e.g. +15555550123)

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

interface RequestBody {
  phone?: string;
  circle_id?: string;
  recipient_name?: string;
}

interface InviteLinkRow {
  id: string;
  circle_id: string;
  token: string;
  revoked_at: string | null;
}

const INVITE_BASE_URL = 'https://famlinkapp.com/join';
const RATE_LIMIT_PER_HOUR = 10;

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

/**
 * Normalize a user-entered phone number to E.164. We're US-biased here:
 *   - Strip everything except digits and a leading `+`.
 *   - If the result already starts with `+`, keep as-is (still validate length).
 *   - Otherwise, 10 digits → assume US, prepend `+1`.
 *   - 11 digits starting with `1` → prepend `+`.
 *   - Anything else: reject.
 */
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Keep a leading '+' but strip other non-digits.
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');

  if (hasPlus) {
    // International — must have 8-15 digits per E.164.
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

serve(async (req) => {
  // CORS preflight.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return fail('Method not allowed', 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
  const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return fail('Server misconfigured: missing Supabase env', 500);
  }
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return fail(
      'Twilio is not configured yet. An admin needs to set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.',
      503,
    );
  }

  // --- 1. Parse body ----------------------------------------------------------
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return fail('Invalid JSON body');
  }
  const { phone: rawPhone, circle_id: circleId, recipient_name: recipientName } = body;
  if (!rawPhone || typeof rawPhone !== 'string') return fail('phone is required');
  if (!circleId || typeof circleId !== 'string') return fail('circle_id is required');

  const phoneE164 = normalizePhone(rawPhone);
  if (!phoneE164) {
    return fail(
      "That phone number doesn't look right. Try a US number like (555) 123-4567 or full international form +44 …",
    );
  }

  // --- 2. Verify caller via JWT ----------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return fail('Not authenticated', 401);
  }
  const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userResp, error: userErr } = await authedClient.auth.getUser();
  if (userErr || !userResp?.user) {
    return fail('Not authenticated', 401);
  }
  const callerUserId = userResp.user.id;

  // Service-role client for everything below (RLS-bypass for audit writes).
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- 3. Verify caller is an admin of circle_id -----------------------------
  const { data: memRow, error: memErr } = await admin
    .from('family_memberships')
    .select('role, removed_at')
    .eq('circle_id', circleId)
    .eq('user_id', callerUserId)
    .is('removed_at', null)
    .maybeSingle();
  if (memErr) {
    return fail(`Membership lookup failed: ${memErr.message}`, 500);
  }
  if (!memRow || memRow.role !== 'admin') {
    return fail('Only family admins can send invites', 403);
  }

  // --- 4. Rate limit: 10 sends / rolling hour --------------------------------
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: rateErr } = await admin
    .from('sms_invite_log')
    .select('id', { count: 'exact', head: true })
    .eq('sender_user_id', callerUserId)
    .gte('sent_at', oneHourAgo);
  if (rateErr) {
    return fail(`Rate-limit lookup failed: ${rateErr.message}`, 500);
  }
  if ((recentCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return fail(
      `You can send ${RATE_LIMIT_PER_HOUR} invites per hour. Try again later.`,
      429,
    );
  }

  // --- 5. Fetch or mint active invite link -----------------------------------
  let inviteLink: InviteLinkRow | null = null;
  {
    const { data: existing, error: linkErr } = await admin
      .from('family_invite_links')
      .select('id, circle_id, token, revoked_at')
      .eq('circle_id', circleId)
      .is('revoked_at', null)
      .maybeSingle();
    if (linkErr) {
      return fail(`Invite link lookup failed: ${linkErr.message}`, 500);
    }
    if (existing) {
      inviteLink = existing as InviteLinkRow;
    } else {
      // No active link — mint via the existing RPC. We need to run as the
      // caller so the RPC's auth.uid() check passes (only admins can regen).
      const { data: minted, error: regenErr } = await authedClient.rpc(
        'regenerate_family_invite',
        { _circle_id: circleId },
      );
      if (regenErr) {
        return fail(`Could not mint invite link: ${regenErr.message}`, 500);
      }
      const row = Array.isArray(minted) ? minted[0] : minted;
      if (!row?.token) {
        return fail('Could not mint invite link (empty response)', 500);
      }
      inviteLink = row as InviteLinkRow;
    }
  }

  // --- 6. Build SMS body -----------------------------------------------------
  // Pull caller's display name for the personalised intro.
  const { data: profileRow } = await admin
    .from('profiles')
    .select('display_name')
    .eq('user_id', callerUserId)
    .maybeSingle();
  const callerName = (profileRow?.display_name as string | undefined)?.trim() || 'Someone';

  const greeting = recipientName ? `Hey ${recipientName.trim()}!` : 'Hey!';
  const joinUrl = `${INVITE_BASE_URL}/${inviteLink.token}`;
  const message =
    `${greeting} ${callerName} invited you to join their family on FamLink — ` +
    `a private space to keep memories together. Tap to join: ${joinUrl} 🌳`;

  // --- 7. Insert queued log row ----------------------------------------------
  const { data: logRow, error: logInsertErr } = await admin
    .from('sms_invite_log')
    .insert({
      sender_user_id: callerUserId,
      circle_id: circleId,
      phone_e164: phoneE164,
      status: 'queued',
    })
    .select('id')
    .single();
  if (logInsertErr || !logRow) {
    return fail(`Could not write audit log: ${logInsertErr?.message ?? 'unknown'}`, 500);
  }
  const logId = logRow.id as string;

  // --- 8. Call Twilio --------------------------------------------------------
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const formBody = new URLSearchParams({
    From: TWILIO_PHONE_NUMBER,
    To: phoneE164,
    Body: message,
  });

  let twilioSid: string | null = null;
  let twilioError: string | null = null;
  try {
    const twilioResp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });
    const twilioJson = (await twilioResp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!twilioResp.ok) {
      twilioError =
        (twilioJson?.message as string | undefined) ||
        `Twilio error (HTTP ${twilioResp.status})`;
    } else {
      twilioSid = (twilioJson?.sid as string | undefined) ?? null;
    }
  } catch (err) {
    twilioError = err instanceof Error ? err.message : 'Twilio request failed';
  }

  // --- 9. Patch log row ------------------------------------------------------
  if (twilioError) {
    await admin
      .from('sms_invite_log')
      .update({ status: 'failed', error: twilioError })
      .eq('id', logId);
    return fail(twilioError, 502);
  }

  await admin
    .from('sms_invite_log')
    .update({ status: 'sent', twilio_sid: twilioSid })
    .eq('id', logId);

  return jsonResponse({ ok: true, sid: twilioSid });
});

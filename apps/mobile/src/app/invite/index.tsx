import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useMyUserId } from '../../lib/sessionStore';

/**
 * Share Invite screen. Reads the user's primary family circle, fetches the
 * active invite link (or mints one via `regenerate_family_invite`), and lets
 * the host share it through the OS share sheet (native) or copy-to-clipboard
 * (web).
 *
 * Backed by `family_invite_links` (migration 20260522000004). One active link
 * per circle at a time; regenerate revokes the previous one.
 */

const INVITE_BASE_URL = 'https://famlinkapp.com/join';

interface InviteLink {
  id: string;
  token: string;
  circle_id: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
  label: string | null;
}

interface CircleInfo {
  id: string;
  name: string;
}

interface SmsLogRow {
  id: string;
  phone_e164: string;
  status: 'queued' | 'sent' | 'failed';
  sent_at: string;
  error: string | null;
}

/**
 * One recipient in the multi-invite chip list.
 *
 * `status` starts as 'pending' (queued in the local list, not yet fired).
 * `handleSendAll` walks the list, flipping each chip to 'sending' as the
 * request goes out, then 'sent' or 'failed' on response. We keep failed
 * chips visible so the user can retry without re-typing.
 */
interface Recipient {
  id: string;
  phone: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
}

const SMS_HOURLY_LIMIT = 10;

// Tiny delay between sends so we don't fire 10 parallel Twilio calls and
// trip the server-side rate limiter on the very last chip. Also gives the
// UI a beat to render each chip transitioning to its final state.
const INTER_SEND_DELAY_MS = 250;

let recipientIdCounter = 0;
function nextRecipientId(): string {
  recipientIdCounter += 1;
  return `r${Date.now().toString(36)}-${recipientIdCounter}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function InviteScreen() {
  const insets = useSafeAreaInsets();
  const myUuid = useMyUserId();

  const [circle, setCircle] = useState<CircleInfo | null>(null);
  const [link, setLink] = useState<InviteLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedFlash, setCopiedFlash] = useState(false);

  // --- Multi-recipient SMS invite state ---
  // `recipients` is the working list of chips the user has added but not yet
  // sent (or sent and failed). `draftPhone` is the in-progress input value.
  // We keep sent chips in the list with status='sent' until the user clears
  // them, so they get instant feedback that their batch went out.
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [draftPhone, setDraftPhone] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [batchToast, setBatchToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [smsLog, setSmsLog] = useState<SmsLogRow[]>([]);

  // Server-side rate limit is 10/hour. We track recent sends from the log so
  // the UI can warn before the user wastes effort queueing chips that would
  // 429.
  const recentInHour = smsLog.filter(
    (r) => Date.now() - new Date(r.sent_at).getTime() < 60 * 60 * 1000,
  ).length;
  const hitHourlyCap = recentInHour >= SMS_HOURLY_LIMIT;
  const remainingThisHour = Math.max(0, SMS_HOURLY_LIMIT - recentInHour);

  // Counts derived from the local recipients array.
  const unsent = recipients.filter((r) => r.status === 'pending' || r.status === 'failed');
  const sentCount = recipients.filter((r) => r.status === 'sent').length;
  const canSend = unsent.length > 0 && !sendingAll && !hitHourlyCap;

  const inviteUrl = link ? `${INVITE_BASE_URL}/${link.token}` : '';

  const load = useCallback(async () => {
    if (!myUuid) {
      setError('You need to be signed in to invite family.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);

    try {
      // 1. Find or auto-create the user's primary circle. ensure_family_circle()
      //    is idempotent: returns the existing circle if they have one,
      //    otherwise mints a new "<display_name>'s family" and adds them as
      //    admin. This repairs accounts that predate the signup trigger.
      const { data: ensured, error: ensErr } = await supabase.rpc('ensure_family_circle');
      if (ensErr) throw ensErr;
      const ensuredRow = Array.isArray(ensured) ? ensured[0] : ensured;
      const circleId = ensuredRow?.circle_id as string | undefined;
      const circleName = (ensuredRow?.circle_name as string | undefined) ?? 'your family';
      if (!circleId) {
        throw new Error('Could not set up your family circle. Try signing out and back in.');
      }
      const c: CircleInfo = { id: circleId, name: circleName };
      setCircle(c);

      // 3. Find active link, or mint one.
      const { data: existing, error: linkErr } = await supabase
        .from('family_invite_links')
        .select('*')
        .eq('circle_id', circleId)
        .is('revoked_at', null)
        .maybeSingle();
      if (linkErr) throw linkErr;

      if (existing) {
        setLink(existing as InviteLink);
      } else {
        const { data: minted, error: regenErr } = await supabase.rpc('regenerate_family_invite', {
          _circle_id: circleId,
        });
        if (regenErr) throw regenErr;
        // RPC returns a row (table-returning function shape: object or array).
        const row = Array.isArray(minted) ? minted[0] : minted;
        if (!row) throw new Error('Could not create an invite link. Try again.');
        setLink(row as InviteLink);
      }
    } catch (e) {
      const msg =
        e instanceof Error && e.message ? e.message : 'Something went wrong loading your invite.';
      setError(msg);
      // eslint-disable-next-line no-console
      console.warn('[invite] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [myUuid]);

  useEffect(() => {
    load();
  }, [load]);

  const loadSmsLog = useCallback(async () => {
    if (!myUuid) return;
    const { data, error: logErr } = await supabase
      .from('sms_invite_log')
      .select('id, phone_e164, status, sent_at, error')
      .eq('sender_user_id', myUuid)
      .order('sent_at', { ascending: false })
      .limit(10);
    if (logErr) {
      // eslint-disable-next-line no-console
      console.warn('[invite] sms log load failed:', logErr);
      return;
    }
    setSmsLog((data ?? []) as SmsLogRow[]);
  }, [myUuid]);

  useEffect(() => {
    loadSmsLog();
  }, [loadSmsLog]);

  /**
   * Commit the draft input as a chip. Called on return key, comma, or the
   * little "+" affordance. Validates loosely on the client (at least 7
   * digits); the edge function does strict E.164 normalization server-side
   * before it ever talks to Twilio, so the worst case here is a chip that
   * fails at send time with a clear error.
   */
  const commitDraft = useCallback(() => {
    const raw = draftPhone.trim().replace(/,$/, '');
    if (!raw) {
      setDraftError(null);
      return;
    }
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.length < 7) {
      setDraftError("That doesn't look like a phone number yet.");
      return;
    }
    // Soft dedupe by digits — "+1 555 1234" and "5551234" count as the same chip.
    const exists = recipients.some(
      (r) => r.phone.replace(/[^\d]/g, '') === digits,
    );
    if (exists) {
      setDraftError("You've already added that number.");
      return;
    }
    setRecipients((prev) => [
      ...prev,
      { id: nextRecipientId(), phone: raw, status: 'pending' },
    ]);
    setDraftPhone('');
    setDraftError(null);
  }, [draftPhone, recipients]);

  const removeRecipient = useCallback((id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearSent = useCallback(() => {
    setRecipients((prev) => prev.filter((r) => r.status !== 'sent'));
    setBatchToast(null);
  }, []);

  /**
   * Walk the unsent recipients (pending + previously-failed retries),
   * firing send_sms_invite for each one and updating the chip's status
   * live. Sequential, not parallel — Twilio + our 10/hr server limit are
   * both happier with a paced loop, and the user perceives "watching
   * messages go out one by one" as more trustworthy than a giant batch.
   */
  const handleSendAll = useCallback(async () => {
    if (!circle) return;
    if (unsent.length === 0) return;
    if (hitHourlyCap) {
      setBatchToast({
        kind: 'error',
        text: `You can send ${SMS_HOURLY_LIMIT} invites per hour. Try again later.`,
      });
      return;
    }
    // If the user queued more than they can send this hour, warn but still
    // send up to the cap rather than refusing the whole batch.
    if (unsent.length > remainingThisHour) {
      setBatchToast({
        kind: 'error',
        text: `Only ${remainingThisHour} of your ${unsent.length} invites will go this hour. The rest will roll over — re-tap Send to finish them later.`,
      });
    } else {
      setBatchToast(null);
    }

    setSendingAll(true);
    let firedThisRun = 0;

    for (const r of unsent) {
      if (firedThisRun >= remainingThisHour) break; // hit the hourly cap mid-batch

      setRecipients((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status: 'sending', error: undefined } : x)),
      );

      try {
        const { data, error: invokeErr } = await supabase.functions.invoke<{
          ok: boolean;
          sid?: string;
          error?: string;
        }>('send_sms_invite', {
          body: { phone: r.phone, circle_id: circle.id },
        });
        if (invokeErr) throw invokeErr;
        if (!data?.ok) throw new Error(data?.error || 'Could not send.');

        setRecipients((prev) =>
          prev.map((x) => (x.id === r.id ? { ...x, status: 'sent' } : x)),
        );
      } catch (e) {
        const msg = e instanceof Error && e.message ? e.message : 'Send failed.';
        setRecipients((prev) =>
          prev.map((x) => (x.id === r.id ? { ...x, status: 'failed', error: msg } : x)),
        );
        // eslint-disable-next-line no-console
        console.warn('[invite] sms send failed:', r.phone, e);
      }

      firedThisRun += 1;
      await sleep(INTER_SEND_DELAY_MS);
    }

    setSendingAll(false);
    loadSmsLog();

    // Post-batch summary toast. Recompute counts from latest state via the
    // setter callback so we report the truth, not a stale snapshot.
    setRecipients((prev) => {
      const sent = prev.filter((x) => x.status === 'sent').length;
      const failed = prev.filter((x) => x.status === 'failed').length;
      if (sent > 0 && failed === 0) {
        setBatchToast({
          kind: 'success',
          text: `✓ ${sent} invite${sent === 1 ? '' : 's'} sent.`,
        });
      } else if (sent > 0 && failed > 0) {
        setBatchToast({
          kind: 'error',
          text: `Sent ${sent}, ${failed} failed. Tap a failed chip to remove it, or hit Send again to retry.`,
        });
      } else if (failed > 0) {
        setBatchToast({
          kind: 'error',
          text: `All ${failed} send${failed === 1 ? '' : 's'} failed. Check the numbers and try again.`,
        });
      }
      return prev;
    });
  }, [circle, unsent, hitHourlyCap, remainingThisHour, loadSmsLog]);

  const handleShare = useCallback(async () => {
    if (!link || !circle) return;
    // Single-bubble strategy: embed the URL inside the message and DON'T pass
    // `url` separately. iMessage was rendering two preview cards when given
    // both (one for the text-with-link, one for the url field). With the URL
    // only in the text body, iMessage shows one bubble with an auto-preview
    // underneath. Other share targets (WhatsApp, mail, etc.) all handle the
    // single-string form the same way.
    const message = `Join our family on FamLink — "${circle.name}". Tap to join: ${inviteUrl}`;
    if (Platform.OS === 'web') {
      // Web Share API: pass text only (no url field) so platforms that share
      // to iMessage via the OS bridge don't double-preview.
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ title: 'Join our family on FamLink', text: message });
          return;
        } catch {
          // user cancelled or unavailable, fall through to copy
        }
      }
      await copyLink();
      return;
    }
    try {
      await Share.share({ message });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[invite] share failed:', e);
    }
  }, [link, circle, inviteUrl]);

  const copyLink = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      if (Platform.OS === 'web') {
        const nav: any = typeof navigator !== 'undefined' ? navigator : null;
        if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(inviteUrl);
        }
      } else {
        // No clipboard package installed; on native we re-open the share sheet
        // which exposes "Copy" as one of the targets. Pass only `message`,
        // not `url`, to avoid iMessage double-previewing.
        await Share.share({ message: inviteUrl });
      }
      setCopiedFlash(true);
      setTimeout(() => setCopiedFlash(false), 1500);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[invite] copy failed:', e);
    }
  }, [inviteUrl]);

  const handleRegenerate = useCallback(async () => {
    if (!circle) return;
    const confirmed = await confirmRegenerate();
    if (!confirmed) return;
    setRegenerating(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('regenerate_family_invite', {
        _circle_id: circle.id,
      });
      if (err) throw err;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Could not regenerate. Try again.');
      setLink(row as InviteLink);
    } catch (e) {
      const msg =
        e instanceof Error && e.message ? e.message : 'Could not regenerate the link.';
      setError(msg);
      // eslint-disable-next-line no-console
      console.warn('[invite] regenerate failed:', e);
    } finally {
      setRegenerating(false);
    }
  }, [circle]);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: tokens.color.borderSubtle,
          backgroundColor: tokens.color.bgSecondary,
        }}
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/family');
            }
          }}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: tokens.color.bgPrimary,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text style={{ fontSize: 20, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
          Invite family
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 40,
          gap: 18,
        }}
      >
        {loading && (
          <View style={{ paddingVertical: 60, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={tokens.color.accentPrimary} />
            <Text style={{ color: tokens.color.textMuted, fontSize: 14 }}>
              Preparing your invite link…
            </Text>
          </View>
        )}

        {!loading && error && (
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: tokens.color.danger + '40',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 32 }}>😔</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
              We couldn't load your invite link.
            </Text>
            <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
              {error}
            </Text>
            <Pressable
              onPress={load}
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                marginTop: 4,
                paddingHorizontal: 18,
                paddingVertical: 10,
                backgroundColor: tokens.color.accentPrimary,
                borderRadius: 999,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Try again</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && link && circle && (
          <>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: tokens.color.textPrimary }}>
                Invite your family
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: tokens.color.textSecondary,
                  lineHeight: 22,
                }}
              >
                Share this link in your family group chat. Anyone who taps it will be added to{' '}
                <Text style={{ fontWeight: '700', color: tokens.color.textPrimary }}>
                  {circle.name}
                </Text>
                .
              </Text>
            </View>

            {/* The URL — read-only field */}
            <View
              style={{
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: tokens.color.textMuted,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                }}
              >
                YOUR INVITE LINK
              </Text>
              <TextInput
                value={inviteUrl}
                editable={false}
                selectTextOnFocus
                multiline={Platform.OS === 'web'}
                style={{
                  fontSize: 15,
                  color: tokens.color.textPrimary,
                  fontWeight: '500',
                }}
              />
            </View>

            {/* Big primary share button */}
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => ({
                backgroundColor: tokens.color.accentPrimary,
                opacity: pressed ? 0.85 : 1,
                height: 56,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              })}
            >
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>Share link</Text>
            </Pressable>

            {/* Secondary copy button */}
            <Pressable
              onPress={copyLink}
              style={({ pressed }) => ({
                backgroundColor: tokens.color.bgPrimary,
                borderWidth: 1,
                borderColor: tokens.color.accentPrimary,
                opacity: pressed ? 0.7 : 1,
                height: 50,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 15 }}>
                {copiedFlash ? 'Copied!' : 'Copy link'}
              </Text>
            </Pressable>

            {/* Usage stats */}
            <Text style={{ fontSize: 12, color: tokens.color.textMuted, paddingHorizontal: 4 }}>
              {link.uses === 0
                ? 'No one has joined with this link yet.'
                : `${link.uses} ${link.uses === 1 ? 'person has' : 'people have'} joined with this link.`}
            </Text>

            {/* Regenerate */}
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <Pressable
                onPress={handleRegenerate}
                disabled={regenerating}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  opacity: pressed || regenerating ? 0.5 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                })}
              >
                {regenerating && <ActivityIndicator size="small" color={tokens.color.textMuted} />}
                <Text
                  style={{
                    color: tokens.color.textMuted,
                    fontSize: 13,
                    textDecorationLine: 'underline',
                  }}
                >
                  {regenerating ? 'Regenerating…' : 'Regenerate link'}
                </Text>
              </Pressable>
            </View>

            {/* ----------------------------------------------------------- */}
            {/* Multi-recipient SMS invite card                              */}
            {/* ----------------------------------------------------------- */}
            <View
              style={{
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
                padding: 18,
                gap: 12,
                marginTop: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text
                  style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}
                >
                  Or text them directly
                </Text>
                {sentCount > 0 && (
                  <Text style={{ fontSize: 12, color: tokens.color.success, fontWeight: '600' }}>
                    {sentCount} sent
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 19 }}>
                Add Mom, Dad, your siblings, grandparents — anyone. We'll text everyone a
                one-tap join link.
              </Text>

              {/* Draft input row: number field + add chip button */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={draftPhone}
                  onChangeText={(v) => {
                    setDraftPhone(v);
                    if (draftError) setDraftError(null);
                    // Comma is a "commit this chip" shortcut on web/desktop.
                    if (v.endsWith(',')) {
                      setDraftPhone(v.slice(0, -1));
                      setTimeout(commitDraft, 0);
                    }
                  }}
                  onSubmitEditing={commitDraft}
                  placeholder="+1 555 123 4567"
                  placeholderTextColor={tokens.color.textMuted}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  returnKeyType="done"
                  editable={!sendingAll}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: draftError
                      ? tokens.color.danger + '80'
                      : tokens.color.borderSubtle,
                    paddingHorizontal: 14,
                    fontSize: 16,
                    color: tokens.color.textPrimary,
                    backgroundColor: tokens.color.bgSecondary,
                  }}
                />
                <Pressable
                  onPress={commitDraft}
                  disabled={!draftPhone.trim() || sendingAll}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    height: 48,
                    width: 48,
                    borderRadius: 12,
                    backgroundColor: tokens.color.bgTinted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed || !draftPhone.trim() || sendingAll ? 0.4 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 24,
                      color: tokens.color.accentPrimary,
                      fontWeight: '700',
                      marginTop: -2,
                    }}
                  >
                    +
                  </Text>
                </Pressable>
              </View>

              {draftError && (
                <Text style={{ fontSize: 12, color: tokens.color.danger, paddingHorizontal: 2 }}>
                  {draftError}
                </Text>
              )}

              {/* Chip list */}
              {recipients.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {recipients.map((r) => (
                    <RecipientChip
                      key={r.id}
                      recipient={r}
                      onRemove={() => removeRecipient(r.id)}
                      disabled={sendingAll}
                    />
                  ))}
                </View>
              )}

              {/* Send all button — primary CTA, shows count of unsent chips */}
              <Pressable
                onPress={handleSendAll}
                disabled={!canSend}
                style={({ pressed }) => ({
                  backgroundColor: tokens.color.accentPrimary,
                  opacity: pressed || !canSend ? 0.4 : 1,
                  height: 48,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  marginTop: 4,
                })}
              >
                {sendingAll && <ActivityIndicator size="small" color="white" />}
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
                  {sendingAll
                    ? 'Sending…'
                    : unsent.length === 0
                      ? sentCount > 0
                        ? 'All sent ✓'
                        : 'Add someone above'
                      : unsent.length === 1
                        ? 'Send 1 invite'
                        : `Send ${unsent.length} invites`}
                </Text>
              </Pressable>

              {batchToast && (
                <View
                  style={{
                    backgroundColor:
                      batchToast.kind === 'success'
                        ? tokens.color.success + '20'
                        : tokens.color.danger + '20',
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color:
                        batchToast.kind === 'success'
                          ? tokens.color.success
                          : tokens.color.danger,
                      fontWeight: '600',
                      lineHeight: 19,
                    }}
                  >
                    {batchToast.text}
                  </Text>
                </View>
              )}

              {/* Footer row: rate-limit hint + clear-sent shortcut */}
              {(recentInHour >= 3 || sentCount > 0) && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  {recentInHour >= 3 ? (
                    <Text style={{ fontSize: 12, color: tokens.color.textMuted, flex: 1 }}>
                      {remainingThisHour} of {SMS_HOURLY_LIMIT} invites left this hour.
                    </Text>
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}
                  {sentCount > 0 && !sendingAll && (
                    <Pressable onPress={clearSent} hitSlop={8}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: tokens.color.accentPrimary,
                          fontWeight: '600',
                          textDecorationLine: 'underline',
                        }}
                      >
                        Clear sent
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {/* ----------------------------------------------------------- */}
            {/* Recently sent list                                           */}
            {/* ----------------------------------------------------------- */}
            {smsLog.length > 0 && (
              <View
                style={{
                  backgroundColor: tokens.color.bgPrimary,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: tokens.color.borderSubtle,
                  padding: 14,
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: tokens.color.textMuted,
                    fontWeight: '700',
                    letterSpacing: 0.5,
                  }}
                >
                  RECENTLY SENT
                </Text>
                {smsLog.map((row) => (
                  <View
                    key={row.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 8,
                      borderTopWidth: 1,
                      borderTopColor: tokens.color.borderSubtle,
                      gap: 10,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: tokens.color.textPrimary,
                        fontWeight: '500',
                      }}
                    >
                      {maskPhone(row.phone_e164)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color:
                          row.status === 'sent'
                            ? tokens.color.success
                            : row.status === 'failed'
                              ? tokens.color.danger
                              : tokens.color.textMuted,
                      }}
                    >
                      {row.status}
                    </Text>
                    <Text style={{ fontSize: 12, color: tokens.color.textMuted, minWidth: 64, textAlign: 'right' }}>
                      {formatRelative(row.sent_at)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Footnote */}
            <View
              style={{
                backgroundColor: tokens.color.bgTinted,
                borderRadius: 14,
                padding: 14,
                marginTop: 8,
              }}
            >
              <Text style={{ fontSize: 12, color: tokens.color.textMuted, lineHeight: 18 }}>
                Anyone with the link can join. If you want to invite someone specifically by email,{' '}
                <Text
                  onPress={() => router.push('/new/event')}
                  style={{
                    color: tokens.color.accentPrimary,
                    fontWeight: '700',
                    textDecorationLine: 'underline',
                  }}
                >
                  use a private event invite →
                </Text>
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Visual chip for one pending/sending/sent/failed recipient.
 *
 * - pending: neutral background, X button on the right to remove.
 * - sending: spinner replaces the X. Not removable mid-flight.
 * - sent:    success tint, ✓ icon. Removable.
 * - failed:  danger tint, ! icon, tap to see the error in an alert.
 *            Stays in the list so the user can retry on the next Send.
 */
function RecipientChip({
  recipient,
  onRemove,
  disabled,
}: {
  recipient: Recipient;
  onRemove: () => void;
  disabled: boolean;
}) {
  const { phone, status, error } = recipient;
  const isSending = status === 'sending';
  const isSent = status === 'sent';
  const isFailed = status === 'failed';

  const bg = isSent
    ? tokens.color.success + '18'
    : isFailed
      ? tokens.color.danger + '18'
      : tokens.color.bgTinted;
  const border = isSent
    ? tokens.color.success + '60'
    : isFailed
      ? tokens.color.danger + '60'
      : tokens.color.borderSubtle;
  const textColor = isSent
    ? tokens.color.success
    : isFailed
      ? tokens.color.danger
      : tokens.color.textPrimary;

  return (
    <Pressable
      onPress={() => {
        if (isFailed && error) {
          if (Platform.OS === 'web') {
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
              window.alert(error);
            }
          } else {
            Alert.alert("Couldn't send", error);
          }
        }
      }}
      disabled={!isFailed}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 12,
        paddingRight: 6,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      {isSent && (
        <Text style={{ fontSize: 13, color: textColor, fontWeight: '700' }}>✓</Text>
      )}
      {isFailed && (
        <Text style={{ fontSize: 13, color: textColor, fontWeight: '700' }}>!</Text>
      )}
      <Text style={{ fontSize: 14, fontWeight: '600', color: textColor }}>
        {prettifyPhone(phone)}
      </Text>
      {isSending ? (
        <ActivityIndicator
          size="small"
          color={tokens.color.accentPrimary}
          style={{ marginLeft: 2, marginRight: 4 }}
        />
      ) : (
        <Pressable
          onPress={onRemove}
          disabled={disabled || isSending}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 16,
              color: tokens.color.textMuted,
              fontWeight: '600',
              marginTop: -2,
            }}
          >
            ×
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

/**
 * Light formatting for display only. Doesn't touch what we send to the
 * server (the edge function does strict E.164 normalization itself):
 *   "+15551234567" → "+1 (555) 123-4567"
 *   "5551234567"   → "(555) 123-4567"
 *   anything weird → returned as-is
 */
function prettifyPhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (hasPlus && digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (!hasPlus && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

/**
 * Mask all but the last 4 digits of a phone number.
 *   "+15551234567" → "+1•••4567"
 *   "(555) 123-4567" → "•••4567"
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 4) return phone;
  const last4 = digits.slice(-4);
  const hasPlus = phone.trim().startsWith('+');
  if (hasPlus) {
    // Try to keep the country prefix visible. Heuristic: 1-3 leading digits.
    const cc = digits.length === 11 ? digits.slice(0, 1) : digits.slice(0, Math.max(1, digits.length - 10));
    return `+${cc}•••${last4}`;
  }
  return `•••${last4}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function confirmRegenerate(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return Promise.resolve(
        window.confirm(
          'Regenerate the invite link? The current link will stop working for anyone who hasn\'t used it yet.',
        ),
      );
    }
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      'Regenerate invite link?',
      "The current link will stop working for anyone who hasn't used it yet.",
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Regenerate', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

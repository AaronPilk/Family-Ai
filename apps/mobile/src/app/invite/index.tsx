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

export default function InviteScreen() {
  const insets = useSafeAreaInsets();
  const myUuid = useMyUserId();

  const [circle, setCircle] = useState<CircleInfo | null>(null);
  const [link, setLink] = useState<InviteLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedFlash, setCopiedFlash] = useState(false);

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
      // 1. Find the user's primary circle (earliest joined membership).
      const { data: memRows, error: memErr } = await supabase
        .from('family_memberships')
        .select('circle_id, joined_at')
        .eq('user_id', myUuid)
        .order('joined_at', { ascending: true })
        .limit(1);
      if (memErr) throw memErr;
      const circleId = memRows?.[0]?.circle_id as string | undefined;
      if (!circleId) {
        throw new Error(
          'No family circle found for your account. Try signing out and back in to re-trigger account setup.',
        );
      }

      // 2. Fetch the circle name (for the share text).
      const { data: circleRow, error: circleErr } = await supabase
        .from('family_circles')
        .select('id, name')
        .eq('id', circleId)
        .maybeSingle();
      if (circleErr) throw circleErr;
      const c: CircleInfo = {
        id: circleId,
        name: (circleRow?.name as string | undefined) ?? 'your family',
      };
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

  const handleShare = useCallback(async () => {
    if (!link || !circle) return;
    const message = `Join our family on FamLink — "${circle.name}". Tap to join: ${inviteUrl}`;
    if (Platform.OS === 'web') {
      // Web: prefer navigator.share if available, else copy to clipboard.
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ title: 'Join our family on FamLink', text: message, url: inviteUrl });
          return;
        } catch {
          // user cancelled or unavailable, fall through to copy
        }
      }
      await copyLink();
      return;
    }
    try {
      await Share.share({ message, url: inviteUrl });
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
        // which exposes "Copy" as one of the targets.
        await Share.share({ message: inviteUrl, url: inviteUrl });
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
          onPress={() => router.back()}
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

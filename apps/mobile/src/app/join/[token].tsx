import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useAuthStatus } from '../../lib/sessionStore';
import { setPendingInviteToken, clearPendingInviteToken } from '../../lib/pendingInvite';

/**
 * Claim Link landing — `/join/<token>`.
 *
 * If signed out:
 *   - Persist the token under `pendingInviteToken`
 *   - Route to /(auth)/sign-up; that screen completes the join after sign-up.
 *
 * If signed in:
 *   - Call `claim_family_invite(_token)` and route into /(tabs)/family.
 */
export default function ClaimInvite() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const authStatus = useAuthStatus();

  const [phase, setPhase] = useState<'idle' | 'claiming' | 'success' | 'error' | 'redirecting'>(
    'idle',
  );
  const [circleName, setCircleName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Guard against double-claim from StrictMode double-effects on web.
  const claimingRef = useRef(false);

  const claim = useCallback(async () => {
    if (claimingRef.current || !token) return;
    claimingRef.current = true;
    setPhase('claiming');
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc('claim_family_invite', { _token: token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('That invite link is invalid or already used up.');
      setCircleName((row.circle_name as string) ?? 'your family');
      setPhase('success');
      await clearPendingInviteToken();
      // Brief celebratory pause, then route into the app.
      setTimeout(() => {
        setPhase('redirecting');
        router.replace('/(tabs)/family');
      }, 1000);
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "Couldn't claim that invite. The link may be expired or revoked.";
      setErrorMsg(msg);
      setPhase('error');
      claimingRef.current = false;
      // eslint-disable-next-line no-console
      console.warn('[join] claim failed:', e);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setErrorMsg('This invite link is missing its token.');
      setPhase('error');
      return;
    }
    if (authStatus === 'loading') return;
    if (authStatus === 'signed-out') {
      // Stash the token, redirect to sign-up.
      (async () => {
        await setPendingInviteToken(token);
        setPhase('redirecting');
        router.replace('/(auth)/sign-up');
      })();
      return;
    }
    if (authStatus === 'signed-in') {
      claim();
    }
  }, [authStatus, token, claim]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.bgSecondary,
        paddingTop: insets.top + 80,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 32,
        alignItems: 'center',
      }}
    >
      <View style={{ width: '100%', maxWidth: 420, gap: 16, alignItems: 'center' }}>
        {(phase === 'idle' || phase === 'claiming' || phase === 'redirecting') && (
          <>
            <ActivityIndicator color={tokens.color.accentPrimary} size="large" />
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: tokens.color.textPrimary,
                textAlign: 'center',
              }}
            >
              {authStatus === 'signed-out'
                ? 'Taking you to sign up…'
                : 'Joining your family on FamLink…'}
            </Text>
          </>
        )}

        {phase === 'success' && (
          <>
            <Text style={{ fontSize: 60 }}>🎉</Text>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '700',
                color: tokens.color.textPrimary,
                textAlign: 'center',
                lineHeight: 32,
              }}
            >
              Welcome to {circleName}!
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: tokens.color.textSecondary,
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              Taking you in…
            </Text>
          </>
        )}

        {phase === 'error' && (
          <>
            <Text style={{ fontSize: 56 }}>🔒</Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: tokens.color.textPrimary,
                textAlign: 'center',
              }}
            >
              We couldn't join you in.
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: tokens.color.textSecondary,
                textAlign: 'center',
                lineHeight: 21,
              }}
            >
              {errorMsg ?? 'Ask the family member who shared this link for a fresh one.'}
            </Text>
            <Pressable
              onPress={() => {
                if (authStatus === 'signed-in') claim();
                else router.replace('/');
              }}
              style={({ pressed }) => ({
                marginTop: 8,
                backgroundColor: tokens.color.accentPrimary,
                paddingHorizontal: 22,
                paddingVertical: 12,
                borderRadius: 999,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>
                {authStatus === 'signed-in' ? 'Try again' : 'Go home'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

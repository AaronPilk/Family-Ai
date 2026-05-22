import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStatus } from '../lib/sessionStore';
import { tokens } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { clearPendingInviteToken, getPendingInviteToken } from '../lib/pendingInvite';

/**
 * Root route. Routes by auth status:
 *  - loading: a small spinner while the persisted session is read from
 *             SecureStore
 *  - signed-out: → /welcome (the FamLink intro + sign-up/sign-in entry)
 *  - signed-in:  → /(tabs)   (the real app)
 *
 * Side effect: if a `pendingInviteToken` is stashed (set by /join/<token> when
 * the user wasn't signed in yet), we claim it the first time we see a session
 * here. This covers email-confirmation flow where the user clicks the link
 * from their inbox and lands signed in but not yet in the family circle.
 */
export default function Index() {
  const status = useAuthStatus();
  const [claimRedirect, setClaimRedirect] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'signed-in') return;
    let cancelled = false;
    (async () => {
      const token = await getPendingInviteToken();
      if (!token || cancelled) return;
      try {
        const { error } = await supabase.rpc('claim_family_invite', { _token: token });
        if (!error) {
          if (!cancelled) setClaimRedirect('/(tabs)/family');
        } else {
          // eslint-disable-next-line no-console
          console.warn('[index] pending claim failed:', error.message);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[index] pending claim threw:', e);
      } finally {
        await clearPendingInviteToken();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.color.bgSecondary,
        }}
      >
        <ActivityIndicator color={tokens.color.accentPrimary} />
      </View>
    );
  }

  if (status === 'signed-out') {
    return <Redirect href="/welcome" />;
  }

  if (claimRedirect) {
    return <Redirect href={claimRedirect as '/(tabs)/family'} />;
  }

  return <Redirect href="/(tabs)" />;
}

import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStatus } from '../lib/sessionStore';
import { tokens } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { clearPendingInviteToken, getPendingInviteToken } from '../lib/pendingInvite';
import { useProfile } from '../lib/useProfile';

/**
 * Root route. Routes by auth status:
 *  - loading:    a small spinner while the persisted session is read from
 *                SecureStore
 *  - signed-out: → /welcome (the FamLink intro + sign-up/sign-in entry)
 *  - signed-in:  → /onboarding/welcome if profiles.onboarding_completed is
 *                false; otherwise → /(tabs) (the real app)
 *
 * Side effect: if a `pendingInviteToken` is stashed (set by /join/<token> when
 * the user wasn't signed in yet), we claim it the first time we see a session
 * here. This covers email-confirmation flow where the user clicks the link
 * from their inbox and lands signed in but not yet in the family circle.
 * A successfully-claimed invite trumps onboarding — they go straight into
 * the family view so they can see who invited them.
 */
export default function Index() {
  const status = useAuthStatus();
  const { profile, loading: profileLoading } = useProfile();
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
    return <SplashSpinner />;
  }

  if (status === 'signed-out') {
    return <Redirect href="/welcome" />;
  }

  // Signed-in. Honor a successful invite claim first.
  if (claimRedirect) {
    return <Redirect href={claimRedirect as '/(tabs)/family'} />;
  }

  // Wait for the profile fetch so we know whether onboarding is needed.
  // We never want to flash the tabs and then yank the user back into
  // /onboarding/welcome — that's the bug this gate exists to prevent.
  if (profileLoading) {
    return <SplashSpinner />;
  }

  // null profile + signed-in is rare but legitimate (signup-trigger lag, or
  // a transient fetch error). Treat it as "needs onboarding" — the role +
  // final-step writes inside /onboarding will upsert the row anyway.
  if (!profile) {
    return <Redirect href="/onboarding/welcome" />;
  }

  // Belt-and-suspenders: even if onboarding_completed didn't get flipped on
  // an older account, a profile with both a name AND a role set is
  // demonstrably past onboarding. The backfill migration (000013) handles
  // the common case; this catches anything the migration missed.
  const looksOnboarded =
    profile.onboardingCompleted ||
    (Boolean(profile.displayName?.trim()) && profile.role !== null);

  if (!looksOnboarded) {
    return <Redirect href="/onboarding/welcome" />;
  }

  return <Redirect href="/(tabs)" />;
}

function SplashSpinner() {
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

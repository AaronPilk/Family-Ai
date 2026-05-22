import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingDots, PrimaryButton, SecondaryLink } from './_shared';
import { useMyUserId } from '../../lib/sessionStore';
import { updateProfile } from '../../lib/useProfile';

/**
 * Onboarding step 4 of 4 — Invite (or skip).
 *
 * Both paths flip profiles.onboarding_completed = true, so the root gate
 * stops routing the user here. The previous version of this screen tried to
 * collect a multi-row invite list inline; we've split that out to the
 * standalone /invite screen (which has more room for the SMS/email flow
 * the Twilio agent is wiring up) and made this a single CTA.
 */
export default function OnboardingInviteOrSkip() {
  const insets = useSafeAreaInsets();
  const userId = useMyUserId();
  const [busy, setBusy] = useState<null | 'invite' | 'skip'>(null);

  async function finishOnboarding(): Promise<boolean> {
    if (!userId) return true;
    try {
      await updateProfile(userId, { onboardingCompleted: true });
      return true;
    } catch (e) {
      Alert.alert(
        "Couldn't finish setup",
        "We'll show you onboarding again next time you open the app. " +
          (e instanceof Error ? e.message : ''),
      );
      return false;
    }
  }

  async function handleInvite() {
    setBusy('invite');
    await finishOnboarding();
    setBusy(null);
    router.replace('/invite');
  }

  async function handleSkip() {
    setBusy('skip');
    await finishOnboarding();
    setBusy(null);
    router.replace('/(tabs)');
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
          gap: 28,
          flexGrow: 1,
        }}
      >
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.5,
              color: tokens.color.accentPrimary,
            }}
          >
            ONE MORE THING
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              lineHeight: 34,
            }}
          >
            FamLink is way better with your family in it.
          </Text>
        </View>

        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 20,
            padding: 20,
            gap: 12,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
          }}
        >
          <Text style={{ fontSize: 15, color: tokens.color.textSecondary, lineHeight: 21 }}>
            We'll send a soft text or email — no app required. They can join when they're ready, on
            their own time.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <InviteSuggestionPill label="Mom" />
            <InviteSuggestionPill label="Dad" />
            <InviteSuggestionPill label="A sibling" />
            <InviteSuggestionPill label="Grandparents" />
          </View>
        </View>

        <View
          style={{
            backgroundColor: tokens.color.bgTinted,
            borderRadius: 14,
            padding: 14,
          }}
        >
          <Text style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 19 }}>
            You can always invite later from the Family tab — there's a big "Invite via link" button
            at the top.
          </Text>
        </View>

        <View style={{ flex: 1 }} />
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 28,
          paddingBottom: insets.bottom + 20,
          paddingTop: 12,
          gap: 12,
        }}
      >
        <PrimaryButton
          label="Invite your family"
          onPress={handleInvite}
          loading={busy === 'invite'}
          disabled={busy !== null}
        />
        <SecondaryLink label="Skip for now" onPress={handleSkip} />
        <OnboardingDots step={4} total={4} />
      </View>
    </View>
  );
}

function InviteSuggestionPill({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: tokens.color.bgTinted,
        borderRadius: 999,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.color.accentPrimary }}>
        {label}
      </Text>
    </View>
  );
}

import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingDots, PrimaryButton, SecondaryLink } from './_shared';

/**
 * Onboarding step 4 of 5 — Invite (or skip).
 *
 * Both buttons route to /onboarding/install, which is the new final step.
 * The `onboarding_completed = true` flip used to live here; it moved to the
 * install screen so the gate doesn't bypass install coaching.
 *
 * "Invite your family" pushes /invite (the real multi-recipient SMS screen,
 * chip-based — see apps/mobile/src/app/invite/index.tsx) and we trust the
 * user to use the back button to return to the install step.
 * The install screen is also reachable directly via /onboarding/install if
 * the user manages to land at a tab without it (the root gate handles that
 * via onboarding_completed).
 */
export default function OnboardingInviteOrSkip() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<null | 'invite' | 'skip'>(null);

  async function handleInvite() {
    setBusy('invite');
    router.replace('/onboarding/support');
    // Then push the invite screen on top so the user can fire SMS/email
    // first; back button returns them to the install step.
    router.push('/invite');
    setBusy(null);
  }

  async function handleSkip() {
    setBusy('skip');
    router.replace('/onboarding/support');
    setBusy(null);
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
            Add everyone in one go — Mom, Dad, your siblings, grandparents. We'll text each
            of them a one-tap join link. No app required. They can join when they're ready.
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
        <OnboardingDots step={4} total={6} />
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

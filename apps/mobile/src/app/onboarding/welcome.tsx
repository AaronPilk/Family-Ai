import { router } from 'expo-router';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingDots, PrimaryButton } from './_shared';
import { useProfile, firstNameOf } from '../../lib/useProfile';

/**
 * Onboarding step 1 of 4 — Welcome.
 *
 * Sets the tone: warm, brief, low-friction. Pulls the user's first name from
 * the profile row (derived from auth metadata at signup) so the greeting
 * feels personal. "60 seconds" is the promise — we keep onboarding to four
 * screens to honor it.
 */
export default function OnboardingWelcome() {
  const insets = useSafeAreaInsets();
  const { profile, loading } = useProfile();
  const firstName = firstNameOf(profile?.displayName);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 28,
          flexGrow: 1,
        }}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: 36, paddingVertical: 32 }}>
          <View style={{ alignItems: 'center', gap: 16 }}>
            <FamLinkLogoMark />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                letterSpacing: 2,
                color: tokens.color.accentPrimary,
                textAlign: 'center',
              }}
            >
              FAMLINK
            </Text>
          </View>

          <View style={{ gap: 12, alignItems: 'center' }}>
            {loading ? (
              <ActivityIndicator color={tokens.color.accentPrimary} />
            ) : (
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '700',
                  color: tokens.color.textPrimary,
                  textAlign: 'center',
                  lineHeight: 38,
                }}
              >
                Welcome, {firstName}.
              </Text>
            )}
            <Text
              style={{
                fontSize: 17,
                color: tokens.color.textSecondary,
                textAlign: 'center',
                lineHeight: 24,
                maxWidth: 320,
              }}
            >
              Let's set you up in 60 seconds.
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: tokens.color.textMuted,
                textAlign: 'center',
                fontStyle: 'italic',
                marginTop: 4,
              }}
            >
              Memories that last forever.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 28,
          paddingBottom: insets.bottom + 20,
          paddingTop: 12,
          gap: 16,
        }}
      >
        <PrimaryButton
          label="Continue"
          onPress={() => router.replace('/onboarding/how-it-works')}
        />
        <OnboardingDots step={1} total={4} />
      </View>
    </View>
  );
}

function FamLinkLogoMark() {
  // Lightweight glyph — the welcome screen already shows the full logo
  // (see /welcome). Here we use a soft accent disc so onboarding feels
  // like a fresh surface rather than a repeat of the marketing screen.
  return (
    <View
      style={{
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: tokens.color.bgTinted,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
      }}
    >
      <Text style={{ fontSize: 44 }}>💗</Text>
    </View>
  );
}

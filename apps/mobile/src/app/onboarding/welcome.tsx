import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingDots, PrimaryButton } from './_shared';
import { useProfile, firstNameOf, updateProfile } from '../../lib/useProfile';
import { useMyUserId } from '../../lib/sessionStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const symbolLogo = require('../../../assets/symbol.png');

/**
 * Onboarding step 1 of 5 — Welcome + name capture.
 *
 * The user has just confirmed their email; they're signed in but their
 * `profiles.display_name` is empty (Supabase auth doesn't pass a name field
 * through email/password signup). This screen is the ONE place we ask for
 * the name. Without it, the rest of the app would address them as their
 * email username, which family members tagging them later would see —
 * "Tylerpilk8" instead of "Tyler" — and that's the wrong first impression.
 *
 * If display_name is already set (returning user finishing onboarding, or
 * a user we backfilled via SQL), skip the input and show the greeting
 * straight through.
 */
export default function OnboardingWelcome() {
  const insets = useSafeAreaInsets();
  const userId = useMyUserId();
  const { profile, loading: profileLoading, refresh } = useProfile();

  // Editable name state — pre-fill if profile already has one.
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (profileLoading || hydrated) return;
    setName(profile?.displayName ?? '');
    setHydrated(true);
  }, [profileLoading, hydrated, profile?.displayName]);

  const trimmed = name.trim();
  const hasExistingName = Boolean(profile?.displayName?.trim());
  const canContinue = trimmed.length >= 2 && !saving;

  async function handleContinue() {
    if (!canContinue) return;
    // If the name in the input matches what's already saved, skip the write.
    const next = trimmed;
    if (userId && next !== (profile?.displayName ?? '').trim()) {
      setSaving(true);
      try {
        await updateProfile(userId, { displayName: next });
        await refresh();
      } catch (e) {
        Alert.alert(
          "Couldn't save your name",
          "We'll try again next time. " + (e instanceof Error ? e.message : ''),
        );
      } finally {
        setSaving(false);
      }
    }
    router.replace('/onboarding/how-it-works');
  }

  const firstName = firstNameOf(profile?.displayName);
  const hasRealName = !!firstName && firstName.toLowerCase() !== 'there';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 36,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: 28, paddingVertical: 16 }}>
          <View style={{ alignItems: 'center', gap: 14 }}>
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

          <View style={{ gap: 10, alignItems: 'center' }}>
            {profileLoading && !hydrated ? (
              <ActivityIndicator color={tokens.color.accentPrimary} />
            ) : (
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: tokens.color.textPrimary,
                  textAlign: 'center',
                  lineHeight: 34,
                }}
              >
                {hasRealName ? `Welcome, ${firstName}.` : 'Welcome.'}
              </Text>
            )}
            <Text
              style={{
                fontSize: 15,
                color: tokens.color.textSecondary,
                textAlign: 'center',
                lineHeight: 22,
                maxWidth: 320,
              }}
            >
              {hasExistingName
                ? "Let's set you up in 60 seconds."
                : "What should we call you?\nThis is the name your family will see."}
            </Text>
          </View>

          {/* Name input — always shown, pre-filled when already set. */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.2,
                color: tokens.color.textMuted,
                paddingHorizontal: 4,
              }}
            >
              YOUR NAME
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Aaron Pilkington"
              placeholderTextColor={tokens.color.textMuted}
              autoCapitalize="words"
              autoComplete="name"
              autoCorrect={false}
              editable={!saving}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              style={{
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: tokens.color.borderSubtle,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 18,
                color: tokens.color.textPrimary,
                fontWeight: '600',
              }}
            />
            <Text
              style={{
                fontSize: 12,
                color: tokens.color.textMuted,
                paddingHorizontal: 4,
                lineHeight: 17,
              }}
            >
              First and last name is best — that's how your relatives will recognize you.
            </Text>
          </View>

          <Text
            style={{
              fontSize: 13,
              color: tokens.color.textMuted,
              textAlign: 'center',
              fontStyle: 'italic',
              marginTop: 4,
            }}
          >
            Memories that last forever.
          </Text>
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
          label={saving ? 'Saving…' : 'Continue'}
          onPress={handleContinue}
          disabled={!canContinue}
          loading={saving}
        />
        <OnboardingDots step={1} total={6} />
      </View>
    </KeyboardAvoidingView>
  );
}

function FamLinkLogoMark() {
  // Real heart-and-figures logo asset, framed in a soft tinted disc so it
  // reads as a logo rather than a sticker.
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
        overflow: 'hidden',
      }}
    >
      <Image
        source={symbolLogo}
        accessibilityLabel="FamLink logo"
        style={{ width: 64, height: 64 }}
        resizeMode="contain"
      />
    </View>
  );
}

import { useState } from 'react';
import { router } from 'expo-router';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';

export default function YourName() {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const canContinue = firstName.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          justifyContent: 'space-between',
        }}
      >
        <View>
          <OnboardingHeader step={1} total={3} />

          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              marginTop: 24,
              lineHeight: 34,
            }}
          >
            What's your name?
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: tokens.color.textSecondary,
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            This is how the people you invite will see you. You can change it later.
          </Text>

          <View
            style={{
              marginTop: 32,
              gap: 12,
            }}
          >
            <Field label="FIRST NAME">
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Aaron"
                placeholderTextColor={tokens.color.textMuted}
                autoCapitalize="words"
                autoComplete="given-name"
                returnKeyType="next"
                style={{
                  fontSize: 22,
                  color: tokens.color.textPrimary,
                  fontWeight: '600',
                }}
              />
            </Field>
            <Field label="LAST NAME (OPTIONAL)">
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Pilkington"
                placeholderTextColor={tokens.color.textMuted}
                autoCapitalize="words"
                autoComplete="family-name"
                returnKeyType="done"
                style={{
                  fontSize: 22,
                  color: tokens.color.textPrimary,
                  fontWeight: '600',
                }}
              />
            </Field>
          </View>

          <Text
            style={{
              fontSize: 13,
              color: tokens.color.textMuted,
              marginTop: 14,
              lineHeight: 19,
            }}
          >
            Next you'll invite your immediate family. You can always add more people — cousins,
            aunts, friends — later when you plan an event together.
          </Text>
        </View>

        <PrimaryNext
          label="Continue"
          disabled={!canContinue}
          onPress={() => router.push('/onboarding/invite')}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: tokens.color.textMuted,
          marginBottom: 4,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export function OnboardingHeader({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          padding: 6,
          marginLeft: -6,
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <Text style={{ fontSize: 22, color: tokens.color.textPrimary }}>‹</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i < step ? tokens.color.accentPrimary : tokens.color.borderSubtle,
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '600' }}>
        Step {step} of {total}
      </Text>
    </View>
  );
}

export function PrimaryNext({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: disabled ? '#D8C7CC' : tokens.color.accentPrimary,
        opacity: pressed ? 0.85 : 1,
        height: 56,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text style={{ color: 'white', fontWeight: '600', fontSize: 17 }}>{label}</Text>
    </Pressable>
  );
}

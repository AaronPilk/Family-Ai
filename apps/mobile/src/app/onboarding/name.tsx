import { useState } from 'react';
import { router } from 'expo-router';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';

export default function NameFamily() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('The Pilks');

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
            What should we call your family?
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: tokens.color.textSecondary,
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            You can change this later. It's just how the app refers to your group of people.
          </Text>

          <View
            style={{
              marginTop: 32,
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginBottom: 4 }}>
              FAMILY NAME
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. The Pilks"
              placeholderTextColor={tokens.color.textMuted}
              style={{
                fontSize: 22,
                color: tokens.color.textPrimary,
                fontWeight: '600',
              }}
            />
          </View>

          <Text
            style={{
              fontSize: 13,
              color: tokens.color.textMuted,
              marginTop: 12,
              lineHeight: 18,
            }}
          >
            Most families use one group. If yours is more complex (divorced parents, in-laws, chosen
            family), you can add more groups later from Settings.
          </Text>
        </View>

        <PrimaryNext label="Continue" onPress={() => router.push('/onboarding/invite')} />
      </View>
    </KeyboardAvoidingView>
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

export function PrimaryNext({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.accentPrimary,
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

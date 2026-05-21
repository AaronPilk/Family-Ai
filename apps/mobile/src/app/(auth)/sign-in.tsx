import { router } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const enterOnboarding = () => router.replace('/onboarding/name');
  const skipToDemo = () => router.replace('/(tabs)');

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.bgSecondary,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
      }}
    >
      {/* Back chevron */}
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          padding: 8,
          marginLeft: -8,
          marginBottom: 16,
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <Text style={{ fontSize: 22, color: tokens.color.textPrimary }}>←</Text>
      </Pressable>

      <Text
        style={{
          fontSize: 28,
          fontWeight: '700',
          color: tokens.color.textPrimary,
          marginBottom: 8,
        }}
      >
        Sign in
      </Text>
      <Text
        style={{
          fontSize: 16,
          color: tokens.color.textSecondary,
          lineHeight: 24,
          marginBottom: 32,
        }}
      >
        Real auth lands in the next batch. For now, any option takes you into onboarding.
      </Text>

      <View style={{ gap: 12 }}>
        <PrimaryButton label="Continue with Apple" onPress={enterOnboarding} />
        <SecondaryButton label="Continue with email" onPress={enterOnboarding} />
        <SecondaryButton label="Continue with phone" onPress={enterOnboarding} />
      </View>

      <Pressable
        onPress={skipToDemo}
        style={({ pressed }) => ({
          marginTop: 24,
          paddingVertical: 12,
          alignItems: 'center',
          opacity: pressed ? 0.5 : 0.7,
        })}
      >
        <Text style={{ color: tokens.color.textMuted, fontSize: 14 }}>
          Skip onboarding → straight to demo
        </Text>
      </Pressable>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
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

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        opacity: pressed ? 0.7 : 1,
        height: 56,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: tokens.color.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text style={{ color: tokens.color.textPrimary, fontWeight: '600', fontSize: 17 }}>
        {label}
      </Text>
    </Pressable>
  );
}

import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import { tokens } from '../../theme/tokens';

/**
 * Shared onboarding chrome — progress dots + primary button + secondary link.
 * Used by welcome, how-it-works, role, and invite screens. Kept here so the
 * four screens share one visual language without a leaky internal import
 * (the old setup re-imported from `./name`, which we've since retired).
 */

export function OnboardingDots({
  step,
  total,
}: {
  step: number;
  total: number;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const active = i + 1 === step;
        const passed = i + 1 < step;
        return (
          <View
            key={i}
            style={{
              width: active ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                active || passed ? tokens.color.accentPrimary : tokens.color.borderStrong,
            }}
          />
        );
      })}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ({
        backgroundColor: isDisabled ? '#D8C7CC' : tokens.color.accentPrimary,
        opacity: pressed ? 0.85 : 1,
        height: 56,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
      })}
    >
      {loading ? <ActivityIndicator color="white" /> : null}
      <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Text
        style={{
          color: tokens.color.textSecondary,
          fontWeight: '500',
          fontSize: 15,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

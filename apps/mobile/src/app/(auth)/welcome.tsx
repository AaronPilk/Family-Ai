import { router } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';

export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.bgSecondary,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 28,
        justifyContent: 'space-between',
      }}
    >
      <View>
        <Text
          style={{
            color: tokens.color.accentPrimary,
            fontWeight: '700',
            letterSpacing: 2,
            fontSize: 12,
          }}
        >
          KIN
        </Text>
      </View>

      <View style={{ alignItems: 'center', gap: 24 }}>
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: tokens.color.bgTinted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: tokens.color.accentPrimary,
              opacity: 0.85,
            }}
          />
        </View>
        <Text
          style={{
            fontSize: 34,
            fontWeight: '700',
            color: tokens.color.textPrimary,
            textAlign: 'center',
            lineHeight: 40,
          }}
        >
          Welcome.
        </Text>
        <Text
          style={{
            fontSize: 17,
            color: tokens.color.textSecondary,
            textAlign: 'center',
            lineHeight: 26,
            maxWidth: 320,
          }}
        >
          A quiet place for your family. Ask anything. Save every answer.
        </Text>
      </View>

      <Pressable
        onPress={() => router.push('/onboarding/name')}
        style={({ pressed }) => ({
          backgroundColor: tokens.color.accentPrimary,
          height: 56,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          shadowColor: tokens.color.accentPrimary,
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        })}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 17 }}>Get started</Text>
      </Pressable>
    </View>
  );
}

import { router } from 'expo-router';
import { View, Text, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';

/**
 * Welcome screen — entrypoint for signed-out users.
 *
 * Runs on iOS, Android, and the web (famlinkapp.com). The outer container
 * fills the viewport with the cream background; an inner column constrains
 * content to a phone-width column so the desktop layout doesn't sprawl.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.color.bgSecondary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 440,
          flex: 1,
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
            FAMLINK
          </Text>
        </View>

        <View style={{ alignItems: 'center', gap: 18 }}>
          <Image
            source={require('../../../assets/symbol-512.png')}
            style={{ width: 180, height: 180 }}
            resizeMode="contain"
          />
          <Text
            style={{
              fontSize: 44,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              textAlign: 'center',
              lineHeight: 50,
              letterSpacing: -0.8,
            }}
          >
            <Text style={{ color: tokens.color.accentPrimary }}>Fam</Text>
            <Text style={{ color: tokens.color.textPrimary }}>Link</Text>
          </Text>
          <Text
            style={{
              fontSize: 17,
              color: tokens.color.textSecondary,
              textAlign: 'center',
              lineHeight: 24,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              fontWeight: '500',
            }}
          >
            family memories that last forever.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
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
          <Pressable
            onPress={() => router.push('/(auth)/sign-in')}
            style={({ pressed }) => ({
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={{ color: tokens.color.textSecondary, fontWeight: '500' }}>
              Already have an account?{' '}
              <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700' }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

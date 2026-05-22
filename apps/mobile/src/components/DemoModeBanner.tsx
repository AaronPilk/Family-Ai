import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

/**
 * Sticky coral banner shown above every screen that's rendering demo data
 * (i.e. the user hasn't invited anyone yet, so `useHasFamily()` returns false).
 *
 * Distinct from `<DemoBanner>`, which is dismissible and labels one-off mock
 * screens (e.g. Notifications). This banner stays visible until the user has
 * a real second family member; once that flips, every screen drops the banner
 * and the demo data together.
 *
 * Includes an inline "Invite family" CTA that routes to `/invite`. Not
 * dismissible — the demo state itself is the dismissal mechanism.
 */
export function DemoModeBanner() {
  return (
    <View
      style={{
        backgroundColor: tokens.color.accentPrimary + '15',
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: tokens.color.accentPrimary + '30',
      }}
    >
      <View
        style={{
          backgroundColor: tokens.color.accentPrimary,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 4,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '800', fontSize: 11, letterSpacing: 0.8 }}>
          DEMO
        </Text>
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 12,
          color: tokens.color.textPrimary,
          lineHeight: 16,
        }}
      >
        This is what FamLink looks like with family. Yours appears here as soon as you invite
        someone.
      </Text>
      <Pressable
        onPress={() => router.push('/invite')}
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 7,
          backgroundColor: tokens.color.accentPrimary,
          borderRadius: 999,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Invite family</Text>
      </Pressable>
    </View>
  );
}

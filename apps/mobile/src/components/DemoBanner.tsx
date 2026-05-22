import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

/**
 * Dismissible coral banner labeling a screen as demo content. Reappears on
 * next mount until the user invites family.
 *
 * NOTE: the sticky, undismissible variant tied to `useHasFamily()` lives in
 * `DemoModeBanner.tsx` — that's what every tab uses. This dismissible
 * variant is kept around for one-off mock surfaces that haven't been wired
 * to real data yet (e.g. coming-soon teaser screens). Both use the same
 * coral-tinted background and DEMO chip.
 */
export function DemoBanner({ message }: { message?: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const copy =
    message ??
    'DEMO — This is what FamLink looks like with family. Yours appears once you invite someone.';
  return (
    <View
      style={{
        backgroundColor: tokens.color.accentPrimary + '15',
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
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
          marginTop: 1,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '800', fontSize: 11, letterSpacing: 0.8 }}>
          DEMO
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontSize: 13,
            color: tokens.color.textPrimary,
            lineHeight: 18,
          }}
        >
          {copy}
        </Text>
        <Pressable onPress={() => router.push('/invite')} hitSlop={6}>
          <Text
            style={{
              fontSize: 13,
              color: tokens.color.accentPrimary,
              fontWeight: '700',
            }}
          >
            Invite family →
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => setHidden(true)}
        hitSlop={12}
        style={({ pressed }) => ({
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <Text
          style={{
            fontSize: 18,
            color: tokens.color.accentPrimary,
            fontWeight: '700',
            lineHeight: 20,
          }}
        >
          ×
        </Text>
      </Pressable>
    </View>
  );
}

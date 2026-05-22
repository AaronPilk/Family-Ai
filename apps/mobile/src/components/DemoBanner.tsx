import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

/**
 * Dismissible coral banner that labels a screen as demo content. Used on
 * screens that still render canned mock data so beta users don't mistake
 * fake activity for real family activity.
 *
 * State is per-mount (useState) — dismissing hides the banner for the rest
 * of the session but it returns on next navigation. That's intentional for
 * the pre-launch window; once mock screens are wired to Supabase the banner
 * gets deleted entirely.
 */
export function DemoBanner({ message }: { message: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
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
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          color: tokens.color.textPrimary,
          lineHeight: 18,
        }}
      >
        {message}
      </Text>
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

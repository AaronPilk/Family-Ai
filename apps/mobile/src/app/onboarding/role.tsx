import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingDots, PrimaryButton } from './_shared';
import { useMyUserId } from '../../lib/sessionStore';
import { updateProfile } from '../../lib/useProfile';
import { useBranchStore, dbRoleToClient, type DbRole } from '../../lib/branchStore';

interface RoleCard {
  id: DbRole;
  title: string;
  body: string;
  glyph: string;
}

const ROLES: RoleCard[] = [
  {
    id: 'elder',
    title: "I'm a parent or grandparent",
    body: "You're the storyteller. We'll ask you gentle questions and the answers become a timeline only your family can see.",
    glyph: '👴',
  },
  {
    id: 'child',
    title: "I'm an adult child or grandchild",
    body: "You're the asker. We'll help you draw stories out of your parents — softly, on their schedule.",
    glyph: '🧑',
  },
  {
    id: 'middle',
    title: "Both — I'm a parent AND I still have parents",
    body: "You're in the middle. We default to asking, but the Ask tab lets you flip to Answer mode for your own kids.",
    glyph: '🧓',
  },
];

/**
 * Onboarding step 3 of 4 — Role.
 *
 * Captures the user's generational role. Persists to profiles.role and to
 * the zustand userRole so the Ask/Answer hero on Home and the default mode
 * on the Ask tab pick correctly on first paint after this screen.
 *
 * The three roles map cleanly to the existing role-aware code:
 *   elder  → Answer mode (storyteller)
 *   child  → Ask mode (asker; mirrors zustand 'younger')
 *   middle → Ask mode by default; users can toggle in-app
 */
export default function OnboardingRole() {
  const insets = useSafeAreaInsets();
  const userId = useMyUserId();
  const [selected, setSelected] = useState<DbRole | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (!selected) return;
    // Always update the zustand store, even if the network call fails — the
    // user has expressed an intent and the local UI should reflect it.
    useBranchStore.getState().setUserRole(dbRoleToClient(selected));

    if (!userId) {
      // Should not happen — the root gate routes signed-out users away.
      router.replace('/onboarding/invite');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(userId, { role: selected });
    } catch (e) {
      Alert.alert(
        "Couldn't save your role",
        "We'll try again next time you change it in your profile. " +
          (e instanceof Error ? e.message : ''),
      );
    } finally {
      setSaving(false);
      router.replace('/onboarding/invite');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
          gap: 24,
        }}
      >
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.5,
              color: tokens.color.accentPrimary,
            }}
          >
            ONE QUICK QUESTION
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              lineHeight: 34,
            }}
          >
            How does your family see you?
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: tokens.color.textSecondary,
              marginTop: 4,
              lineHeight: 21,
            }}
          >
            This helps FamLink show the right prompts. You can change it any time in your profile.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {ROLES.map((r) => (
            <RoleOption
              key={r.id}
              card={r}
              active={selected === r.id}
              onPress={() => setSelected(r.id)}
            />
          ))}
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
          disabled={!selected}
          loading={saving}
        />
        <OnboardingDots step={3} total={4} />
      </View>
    </View>
  );
}

function RoleOption({
  card,
  active,
  onPress,
}: {
  card: RoleCard;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: active ? tokens.color.bgTinted : tokens.color.bgPrimary,
        borderRadius: 18,
        padding: 18,
        flexDirection: 'row',
        gap: 14,
        borderWidth: 2,
        borderColor: active ? tokens.color.accentPrimary : tokens.color.borderSubtle,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: active ? 'white' : tokens.color.bgTinted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 28 }}>{card.glyph}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: active ? tokens.color.accentPrimary : tokens.color.textPrimary,
          }}
        >
          {card.title}
        </Text>
        <Text style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 19 }}>
          {card.body}
        </Text>
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: active ? tokens.color.accentPrimary : tokens.color.borderStrong,
          backgroundColor: active ? tokens.color.accentPrimary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
        }}
      >
        {active ? (
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>✓</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

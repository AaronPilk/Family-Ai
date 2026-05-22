import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingDots, PrimaryButton } from './_shared';
import { useMyUserId } from '../../lib/sessionStore';
import { updateProfile } from '../../lib/useProfile';
import { useBranchStore, dbRoleToClient, type DbRole, type Gender } from '../../lib/branchStore';

/**
 * Onboarding step 3 of 4 — Role.
 *
 * Captures who the user is in their family — both generational role and
 * gender — in a single screen of chips that match how families actually
 * talk. Mom, Dad, Grandma, Grandpa, Son, Daughter, Grandson, Granddaughter.
 *
 * Why both fields matter: the Questions Engine personalizes prompts based
 * on this. "Grandma, tell me about your childhood" reads very differently
 * from "Mom, tell me about your childhood." Coarse-grained elder/child
 * (the old vocabulary) can't tell them apart.
 *
 * Each chip writes a (role, gender) pair to the profile. Mapping:
 *   Mom            → role=parent       gender=female
 *   Dad            → role=parent       gender=male
 *   Grandma        → role=grandparent  gender=female
 *   Grandpa        → role=grandparent  gender=male
 *   Son            → role=child        gender=male
 *   Daughter       → role=child        gender=female
 *   Grandson       → role=grandchild   gender=male
 *   Granddaughter  → role=grandchild   gender=female
 *   Skip / other   → role=middle       gender=null   (Ask mode default; user can
 *                                                     refine later in /profile)
 *
 * The role drives Ask vs Answer mode in the rest of the app via
 * dbRoleToClient — parent/grandparent → 'elder' (Answer hero on Home),
 * child/grandchild → 'younger' (Ask hero), middle → 'middle'.
 */

interface RoleChip {
  id: string;
  label: string;
  glyph: string;
  role: DbRole;
  gender: Gender | null;
  hint: string;
}

const CHIPS: RoleChip[] = [
  {
    id: 'mom',
    label: 'Mom',
    glyph: '👩',
    role: 'parent',
    gender: 'female',
    hint: 'Your kids ask, you answer.',
  },
  {
    id: 'dad',
    label: 'Dad',
    glyph: '👨',
    role: 'parent',
    gender: 'male',
    hint: 'Your kids ask, you answer.',
  },
  {
    id: 'grandma',
    label: 'Grandma',
    glyph: '👵',
    role: 'grandparent',
    gender: 'female',
    hint: 'Grandkids ask, you answer.',
  },
  {
    id: 'grandpa',
    label: 'Grandpa',
    glyph: '👴',
    role: 'grandparent',
    gender: 'male',
    hint: 'Grandkids ask, you answer.',
  },
  {
    id: 'son',
    label: 'Son',
    glyph: '🧑',
    role: 'child',
    gender: 'male',
    hint: 'You ask, your parents answer.',
  },
  {
    id: 'daughter',
    label: 'Daughter',
    glyph: '👧',
    role: 'child',
    gender: 'female',
    hint: 'You ask, your parents answer.',
  },
  {
    id: 'grandson',
    label: 'Grandson',
    glyph: '🧒',
    role: 'grandchild',
    gender: 'male',
    hint: 'You ask, your grandparents answer.',
  },
  {
    id: 'granddaughter',
    label: 'Granddaughter',
    glyph: '👧',
    role: 'grandchild',
    gender: 'female',
    hint: 'You ask, your grandparents answer.',
  },
];

const PREFER_NOT: RoleChip = {
  id: 'prefer_not',
  label: 'Prefer not to say',
  glyph: '✨',
  role: 'middle',
  gender: 'prefer_not',
  hint: "We'll keep prompts neutral. You can change this any time in your profile.",
};

export default function OnboardingRole() {
  const insets = useSafeAreaInsets();
  const userId = useMyUserId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = [...CHIPS, PREFER_NOT].find((c) => c.id === selectedId) ?? null;

  async function handleContinue() {
    if (!selected) return;
    // Mirror role into zustand immediately so Home/Ask render the right hero
    // on the next paint even if the network call lags.
    useBranchStore.getState().setUserRole(dbRoleToClient(selected.role));

    if (!userId) {
      // Should not happen — the root gate routes signed-out users away.
      router.replace('/onboarding/invite');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(userId, {
        role: selected.role,
        gender: selected.gender,
      });
    } catch (e) {
      Alert.alert(
        "Couldn't save your role",
        "We'll try again next time you edit it in your profile. " +
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
          paddingTop: insets.top + 36,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          gap: 20,
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
            Who are you in your family?
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: tokens.color.textSecondary,
              marginTop: 4,
              lineHeight: 21,
            }}
          >
            This tells FamLink whether you're the one asking questions or the one
            answering them — and helps us write prompts that sound right.
          </Text>
        </View>

        {/* Chip grid — 2 columns */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {CHIPS.map((c) => (
            <RoleTile
              key={c.id}
              chip={c}
              active={selectedId === c.id}
              onPress={() => setSelectedId(c.id)}
            />
          ))}
        </View>

        {/* Hint for the currently-selected chip */}
        {selected && (
          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: tokens.color.accentPrimary + '30',
            }}
          >
            <Text style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 19 }}>
              {selected.hint}
            </Text>
          </View>
        )}

        {/* Prefer-not-to-say link — small, secondary */}
        <Pressable
          onPress={() => setSelectedId(PREFER_NOT.id)}
          style={({ pressed }) => ({
            alignSelf: 'center',
            paddingVertical: 8,
            paddingHorizontal: 12,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 13,
              color:
                selectedId === PREFER_NOT.id
                  ? tokens.color.accentPrimary
                  : tokens.color.textMuted,
              fontWeight: selectedId === PREFER_NOT.id ? '700' : '500',
              textDecorationLine: 'underline',
            }}
          >
            Prefer not to say
          </Text>
        </Pressable>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 24,
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

function RoleTile({
  chip,
  active,
  onPress,
}: {
  chip: RoleChip;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: '48%',
        backgroundColor: active ? tokens.color.bgTinted : tokens.color.bgPrimary,
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 14,
        borderWidth: 2,
        borderColor: active ? tokens.color.accentPrimary : tokens.color.borderSubtle,
        opacity: pressed ? 0.85 : 1,
        alignItems: 'center',
        gap: 6,
      })}
    >
      <Text style={{ fontSize: 36 }}>{chip.glyph}</Text>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: active ? tokens.color.accentPrimary : tokens.color.textPrimary,
        }}
      >
        {chip.label}
      </Text>
    </Pressable>
  );
}

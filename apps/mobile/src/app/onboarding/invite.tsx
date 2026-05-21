import { useState } from 'react';
import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingHeader, PrimaryNext } from './name';

/**
 * Onboarding step 2 of 3 — invite immediate family in one flow.
 * The act of inviting Mom IS declaring Mom is immediate family. No separate
 * declaration step. Per kin-event-mode plan: this is the inner ring. Cousins,
 * aunts, uncles, friends come later via events.
 */

interface RoleDef {
  id: string;
  label: string;
  glyph: string;
}

const ROLES: RoleDef[] = [
  { id: 'mom', label: 'Mom', glyph: '👩' },
  { id: 'dad', label: 'Dad', glyph: '👨' },
  { id: 'stepmom', label: 'Stepmom', glyph: '👩‍🦰' },
  { id: 'stepdad', label: 'Stepdad', glyph: '👨‍🦰' },
  { id: 'sister', label: 'Sister', glyph: '👧' },
  { id: 'brother', label: 'Brother', glyph: '👦' },
  { id: 'stepsibling', label: 'Stepsibling', glyph: '🧑' },
  { id: 'grandma', label: 'Grandma', glyph: '👵' },
  { id: 'grandpa', label: 'Grandpa', glyph: '👴' },
  { id: 'partner', label: 'Partner', glyph: '💑' },
  { id: 'child', label: 'Child', glyph: '🧒' },
];

interface InviteRow {
  rowId: string;
  roleId: string;
  roleLabel: string;
  name: string;
  contact: string;
}

let nextRowId = 1;
function makeRow(role: RoleDef): InviteRow {
  return {
    rowId: `r-${nextRowId++}`,
    roleId: role.id,
    roleLabel: role.label,
    name: '',
    contact: '',
  };
}

export default function InviteImmediateFamily() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<InviteRow[]>([
    makeRow(ROLES[0]!), // Mom
    makeRow(ROLES[1]!), // Dad
  ]);

  function addRole(role: RoleDef) {
    setRows((cur) => [...cur, makeRow(role)]);
  }
  function updateRow(rowId: string, patch: Partial<InviteRow>) {
    setRows((cur) => cur.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }
  function removeRow(rowId: string) {
    setRows((cur) => cur.filter((r) => r.rowId !== rowId));
  }

  const filledCount = rows.filter((r) => r.name.trim().length > 0).length;
  const sentLabel =
    filledCount > 0 ? `Send ${filledCount} invite${filledCount === 1 ? '' : 's'}` : 'Continue';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          gap: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <OnboardingHeader step={2} total={3} />

        <View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              lineHeight: 34,
            }}
          >
            Invite your immediate family.
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: tokens.color.textSecondary,
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            Parents, siblings, grandparents — the inner ring. They get a soft text or email and can
            join when they're ready. You can add cousins, aunts, and friends later for events.
          </Text>
        </View>

        {/* Existing invite rows */}
        <View style={{ gap: 12 }}>
          {rows.map((row) => (
            <InviteCard
              key={row.rowId}
              row={row}
              onChange={(patch) => updateRow(row.rowId, patch)}
              onRemove={() => removeRow(row.rowId)}
            />
          ))}
        </View>

        {/* Add another role */}
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
            ADD SOMEONE ELSE
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ROLES.map((role) => (
              <Pressable
                key={role.id}
                onPress={() => addRole(role)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: tokens.color.bgPrimary,
                  borderWidth: 1,
                  borderColor: tokens.color.borderSubtle,
                  opacity: pressed ? 0.7 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                })}
              >
                <Text style={{ fontSize: 14 }}>{role.glyph}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.color.textPrimary }}>
                  + {role.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, lineHeight: 18 }}>
            Have a divorced/blended family? Add a Stepmom or Stepdad — Kin can keep their side
            separate from the other parent's side. (You'll see how on the next screen.)
          </Text>
        </View>

        {/* CTAs */}
        <View style={{ gap: 10 }}>
          <PrimaryNext label={sentLabel} onPress={() => router.push('/onboarding/how-it-works')} />
          <Pressable
            onPress={() => router.push('/onboarding/how-it-works')}
            style={({ pressed }) => ({
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={{ color: tokens.color.textSecondary, fontWeight: '500' }}>
              I'll invite people later →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InviteCard({
  row,
  onChange,
  onRemove,
}: {
  row: InviteRow;
  onChange: (patch: Partial<InviteRow>) => void;
  onRemove: () => void;
}) {
  const role = ROLES.find((r) => r.id === row.roleId);
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        padding: 14,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            backgroundColor: tokens.color.bgTinted,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 14 }}>{role?.glyph ?? '👤'}</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.color.accentPrimary }}>
            {row.roleLabel}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          style={({ pressed }) => ({
            paddingHorizontal: 8,
            paddingVertical: 4,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text style={{ fontSize: 13, color: tokens.color.textMuted, fontWeight: '600' }}>
            Remove
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <View
          style={{
            backgroundColor: tokens.color.bgSecondary,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ fontSize: 11, color: tokens.color.textMuted, fontWeight: '700' }}>
            NAME
          </Text>
          <TextInput
            value={row.name}
            onChangeText={(v) => onChange({ name: v })}
            placeholder={`e.g. ${defaultName(row.roleId)}`}
            placeholderTextColor={tokens.color.textMuted}
            autoCapitalize="words"
            style={{
              fontSize: 17,
              color: tokens.color.textPrimary,
              fontWeight: '500',
              marginTop: 2,
            }}
          />
        </View>
        <View
          style={{
            backgroundColor: tokens.color.bgSecondary,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ fontSize: 11, color: tokens.color.textMuted, fontWeight: '700' }}>
            PHONE OR EMAIL
          </Text>
          <TextInput
            value={row.contact}
            onChangeText={(v) => onChange({ contact: v })}
            placeholder="+1 (555) 123-4567"
            placeholderTextColor={tokens.color.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ fontSize: 16, color: tokens.color.textPrimary, marginTop: 2 }}
          />
        </View>
      </View>
    </View>
  );
}

function defaultName(roleId: string): string {
  switch (roleId) {
    case 'mom':
      return 'Linda';
    case 'dad':
      return 'Tom';
    case 'sister':
      return 'Sara';
    case 'brother':
      return 'Mike';
    case 'grandma':
      return 'Grace';
    case 'grandpa':
      return 'Hal';
    case 'partner':
      return 'Their name';
    case 'child':
      return 'Their name';
    case 'stepmom':
    case 'stepdad':
    case 'stepsibling':
      return 'Their name';
    default:
      return 'Their name';
  }
}

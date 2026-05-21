import { useState } from 'react';
import { router } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';

type ChildRole = 'son' | 'daughter' | 'other';

export default function YourName() {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bMonth, setBMonth] = useState('');
  const [bDay, setBDay] = useState('');
  const [bYear, setBYear] = useState('');
  const [role, setRole] = useState<ChildRole | null>(null);

  const validBirthday = isValidDate(bMonth, bDay, bYear);
  const canContinue = firstName.trim().length > 0 && validBirthday && role !== null;

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
        <OnboardingHeader step={1} total={3} />

        <View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              lineHeight: 34,
            }}
          >
            Tell us about you.
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: tokens.color.textSecondary,
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            This is how the people you invite will see you. You can change it later.
          </Text>
        </View>

        {/* Name */}
        <View style={{ gap: 12 }}>
          <Field label="FIRST NAME">
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Aaron"
              placeholderTextColor={tokens.color.textMuted}
              autoCapitalize="words"
              autoComplete="given-name"
              returnKeyType="next"
              style={{
                fontSize: 22,
                color: tokens.color.textPrimary,
                fontWeight: '600',
              }}
            />
          </Field>
          <Field label="LAST NAME (OPTIONAL)">
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Pilkington"
              placeholderTextColor={tokens.color.textMuted}
              autoCapitalize="words"
              autoComplete="family-name"
              returnKeyType="next"
              style={{
                fontSize: 22,
                color: tokens.color.textPrimary,
                fontWeight: '600',
              }}
            />
          </Field>
        </View>

        {/* Birthday */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
            WHEN'S YOUR BIRTHDAY?
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <DateBox
              flex={1}
              label="MM"
              value={bMonth}
              onChange={(v) => setBMonth(clampDigits(v, 2))}
              maxLength={2}
            />
            <DateBox
              flex={1}
              label="DD"
              value={bDay}
              onChange={(v) => setBDay(clampDigits(v, 2))}
              maxLength={2}
            />
            <DateBox
              flex={1.4}
              label="YYYY"
              value={bYear}
              onChange={(v) => setBYear(clampDigits(v, 4))}
              maxLength={4}
            />
          </View>
          {bMonth || bDay || bYear ? (
            <Text
              style={{
                fontSize: 12,
                color: validBirthday ? tokens.color.success : tokens.color.warning,
                marginTop: 2,
              }}
            >
              {validBirthday
                ? `Born ${formatBirthday(bMonth, bDay, bYear)} · ${ageFrom(bMonth, bDay, bYear)} years old`
                : 'Enter a real date'}
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
              Used for birthday vault releases, age-aware prompts, and "happy birthday" pings.
            </Text>
          )}
        </View>

        {/* Son / Daughter */}
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
            ARE YOU A…
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <RolePill
              label="Son"
              glyph="👦"
              active={role === 'son'}
              onPress={() => setRole('son')}
            />
            <RolePill
              label="Daughter"
              glyph="👧"
              active={role === 'daughter'}
              onPress={() => setRole('daughter')}
            />
            <RolePill
              label="Confused about gender"
              glyph="🌱"
              active={role === 'other'}
              onPress={() => setRole('other')}
            />
          </View>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, lineHeight: 17 }}>
            Helps your family see "Mom's daughter" / "Dad's son" the right way around in the tree.
          </Text>
        </View>

        <Text
          style={{
            fontSize: 13,
            color: tokens.color.textMuted,
            lineHeight: 19,
          }}
        >
          Next you'll invite your immediate family. You can always add more people — cousins, aunts,
          friends — later when you plan an event together.
        </Text>

        <PrimaryNext
          label="Continue"
          disabled={!canContinue}
          onPress={() => router.push('/onboarding/invite')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---- Sub-components --------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: tokens.color.textMuted,
          marginBottom: 4,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function DateBox({
  label,
  value,
  onChange,
  maxLength,
  flex,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  flex: number;
}) {
  return (
    <View
      style={{
        flex,
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ fontSize: 10, color: tokens.color.textMuted, fontWeight: '700' }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={tokens.color.borderStrong}
        keyboardType="number-pad"
        maxLength={maxLength}
        style={{
          fontSize: 20,
          fontWeight: '600',
          color: tokens.color.textPrimary,
          marginTop: 2,
        }}
      />
    </View>
  );
}

function RolePill({
  label,
  glyph,
  active,
  onPress,
}: {
  label: string;
  glyph: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderRadius: 14,
        backgroundColor: active ? tokens.color.accentPrimary : tokens.color.bgPrimary,
        borderWidth: 1.5,
        borderColor: active ? tokens.color.accentPrimary : tokens.color.borderSubtle,
        alignItems: 'center',
        gap: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 22 }}>{glyph}</Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: active ? 'white' : tokens.color.textPrimary,
          textAlign: 'center',
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---- Helpers ---------------------------------------------------------------

function clampDigits(v: string, max: number): string {
  return v.replace(/[^0-9]/g, '').slice(0, max);
}

function isValidDate(mm: string, dd: string, yyyy: string): boolean {
  if (mm.length === 0 || dd.length === 0 || yyyy.length !== 4) return false;
  const m = Number(mm);
  const d = Number(dd);
  const y = Number(yyyy);
  if (!Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(y)) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const thisYear = new Date().getFullYear();
  if (y < 1900 || y > thisYear) return false;
  // Real-calendar sanity check (Feb 30, etc.)
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function formatBirthday(mm: string, dd: string, yyyy: string): string {
  const m = Number(mm);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[m - 1]} ${Number(dd)}, ${yyyy}`;
}

function ageFrom(mm: string, dd: string, yyyy: string): number {
  const y = Number(yyyy);
  const m = Number(mm);
  const d = Number(dd);
  const now = new Date();
  let age = now.getFullYear() - y;
  const hasHadBirthday = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  if (!hasHadBirthday) age -= 1;
  return age;
}

// ---- Re-exports used by other onboarding screens ---------------------------

export function OnboardingHeader({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          padding: 6,
          marginLeft: -6,
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <Text style={{ fontSize: 22, color: tokens.color.textPrimary }}>‹</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i < step ? tokens.color.accentPrimary : tokens.color.borderSubtle,
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '600' }}>
        Step {step} of {total}
      </Text>
    </View>
  );
}

export function PrimaryNext({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: disabled ? '#D8C7CC' : tokens.color.accentPrimary,
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { useMyUserId, signOut } from '../../lib/sessionStore';
import { initialsOf, updateProfile, useProfile } from '../../lib/useProfile';
import type { DbRole, Gender } from '../../lib/branchStore';
import { comingSoon } from '../../lib/comingSoon';
import {
  getPublicUrl,
  pickImage,
  uploadMedia,
  MediaUploadError,
} from '../../lib/mediaUpload';
import { getMySubscription, type MySubscription } from '../../lib/billing';

/**
 * Same 8 chips as the onboarding role picker, mirrored here so the user can
 * change their answer post-onboarding. Each chip writes a (role, gender) pair.
 * Legacy 'elder' values from older accounts collapse into Mom or Dad on first
 * edit — the user picks fresh, we overwrite.
 */
interface RoleChip {
  id: string;
  label: string;
  glyph: string;
  role: DbRole;
  gender: Gender | null;
}

const ROLE_CHIPS: RoleChip[] = [
  { id: 'mom', label: 'Mom', glyph: '👩', role: 'parent', gender: 'female' },
  { id: 'dad', label: 'Dad', glyph: '👨', role: 'parent', gender: 'male' },
  { id: 'grandma', label: 'Grandma', glyph: '👵', role: 'grandparent', gender: 'female' },
  { id: 'grandpa', label: 'Grandpa', glyph: '👴', role: 'grandparent', gender: 'male' },
  { id: 'son', label: 'Son', glyph: '🧑', role: 'child', gender: 'male' },
  { id: 'daughter', label: 'Daughter', glyph: '👧', role: 'child', gender: 'female' },
  { id: 'grandson', label: 'Grandson', glyph: '🧒', role: 'grandchild', gender: 'male' },
  {
    id: 'granddaughter',
    label: 'Granddaughter',
    glyph: '👧',
    role: 'grandchild',
    gender: 'female',
  },
];

/** Match the user's persisted (role, gender) to one of the 8 chip ids. */
function chipIdFor(role: DbRole | null, gender: Gender | null): string | null {
  if (!role) return null;
  const match = ROLE_CHIPS.find((c) => c.role === role && c.gender === gender);
  if (match) return match.id;
  // Best-effort fallback for accounts that have role but no gender (or vice
  // versa, or the legacy 'elder' value). Show the first chip in the bucket.
  if (role === 'parent' || role === 'elder') return 'mom';
  if (role === 'grandparent') return 'grandma';
  if (role === 'child') return 'son';
  if (role === 'grandchild') return 'grandson';
  return null;
}

/**
 * Profile editor — /profile.
 *
 * Auto-saves every field as the user changes it. We debounce text edits so
 * we don't hammer Supabase on every keystroke, then write the row and show
 * a tiny "Saved ✓" indicator for ~1.5s. Photo upload is parked behind
 * comingSoon('upload_photo') until storage wiring lands; the avatar shows
 * initials in the meantime.
 *
 * Date picker note: we use a lightweight MM/DD/YYYY text triplet rather
 * than pulling in @react-native-community/datetimepicker. The dependency
 * isn't in the project yet and the rest of the app (see onboarding/name)
 * uses the same triplet pattern.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const userId = useMyUserId();
  const { profile, loading, error, refresh } = useProfile();

  const [displayName, setDisplayName] = useState('');
  const [bMonth, setBMonth] = useState('');
  const [bDay, setBDay] = useState('');
  const [bYear, setBYear] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [subscription, setSubscription] = useState<MySubscription | null>(null);

  // Load the subscription tier for the Membership row. Best-effort: we don't
  // block profile rendering on a failure, just hide the row.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await getMySubscription();
        if (!cancelled) setSubscription(s);
      } catch {
        // ignore — row is optional UI.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Hydrate once the profile loads.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!profile || hydratedRef.current) return;
    hydratedRef.current = true;
    setDisplayName(profile.displayName ?? '');
    if (profile.birthDate) {
      const [y, m, d] = profile.birthDate.split('-');
      if (y && m && d) {
        setBYear(y);
        setBMonth(String(Number(m)).padStart(2, '0'));
        setBDay(String(Number(d)).padStart(2, '0'));
      }
    }
  }, [profile]);

  function flashSaved() {
    setSaveError(null);
    setSavedAt(Date.now());
  }

  async function save(patch: Parameters<typeof updateProfile>[1]) {
    if (!userId) return;
    try {
      await updateProfile(userId, patch);
      flashSaved();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }

  // Debounce text-field saves (display name).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function debouncedSave(patch: Parameters<typeof updateProfile>[1]) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void save(patch);
    }, 600);
  }

  function onDisplayNameChange(v: string) {
    setDisplayName(v);
    if (v.trim().length > 0) debouncedSave({ displayName: v.trim() });
  }

  function onBirthdayPartChange(field: 'm' | 'd' | 'y', v: string) {
    const digits = v.replace(/[^0-9]/g, '');
    let mm = bMonth;
    let dd = bDay;
    let yyyy = bYear;
    if (field === 'm') {
      mm = digits.slice(0, 2);
      setBMonth(mm);
    } else if (field === 'd') {
      dd = digits.slice(0, 2);
      setBDay(dd);
    } else {
      yyyy = digits.slice(0, 4);
      setBYear(yyyy);
    }
    if (isValidDate(mm, dd, yyyy)) {
      const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      void save({ birthDate: iso });
    }
  }

  async function onRoleChipChange(chipId: string) {
    const chip = ROLE_CHIPS.find((c) => c.id === chipId);
    if (!chip) return;
    await save({ role: chip.role, gender: chip.gender });
  }

  async function onUploadAvatar() {
    if (!userId || uploadingAvatar) return;
    setSaveError(null);
    setUploadingAvatar(true);
    try {
      const picked = await pickImage({ mediaTypes: 'photo' });
      if (!picked) {
        setUploadingAvatar(false);
        return;
      }
      const asset = await uploadMedia(picked, { kind: 'photo' });
      const url = getPublicUrl(asset);
      await updateProfile(userId, { avatarUrl: url });
      flashSaved();
    } catch (e) {
      setSaveError(
        e instanceof MediaUploadError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Couldn't upload that photo.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign out?', "You'll need to sign in again to see your family.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/welcome');
        },
      },
    ]);
  }

  const showSaved = useMemo(() => {
    if (!savedAt) return false;
    return Date.now() - savedAt < 1800;
  }, [savedAt]);

  // Re-render so the "Saved ✓" indicator fades.
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 1900);
    return () => clearTimeout(t);
  }, [savedAt]);

  if (loading && !profile) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.color.bgSecondary,
        }}
      >
        <ActivityIndicator color={tokens.color.accentPrimary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
          gap: 22,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 6, marginLeft: -6 })}
          >
            <Text style={{ fontSize: 28, color: tokens.color.textPrimary, lineHeight: 30 }}>‹</Text>
          </Pressable>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              flex: 1,
            }}
          >
            Your profile
          </Text>
          {showSaved ? (
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: tokens.color.success,
              }}
            >
              Saved ✓
            </Text>
          ) : null}
        </View>

        {error ? (
          <View
            style={{
              backgroundColor: '#FFF1F3',
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: tokens.color.accentSecondary,
            }}
          >
            <Text style={{ color: tokens.color.danger, fontSize: 13 }}>
              Couldn't load profile: {error}
            </Text>
            <Pressable onPress={refresh} style={{ marginTop: 6 }} hitSlop={8}>
              <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 13 }}>
                Try again
              </Text>
            </Pressable>
          </View>
        ) : null}

        {saveError ? (
          <Text style={{ color: tokens.color.warning, fontSize: 13 }}>
            Save failed: {saveError}
          </Text>
        ) : null}

        {/* Avatar */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          {profile?.avatarUrl ? (
            <PhotoAvatar url={profile.avatarUrl} />
          ) : (
            <InitialsAvatar name={displayName} />
          )}
          <Pressable
            onPress={onUploadAvatar}
            disabled={uploadingAvatar}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 999,
              opacity: pressed || uploadingAvatar ? 0.7 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            })}
          >
            {uploadingAvatar && (
              <ActivityIndicator size="small" color={tokens.color.accentPrimary} />
            )}
            <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.color.accentPrimary }}>
              {uploadingAvatar
                ? 'Uploading…'
                : profile?.avatarUrl
                  ? 'Change photo'
                  : 'Upload photo'}
            </Text>
          </Pressable>
        </View>

        {/* Display name */}
        <Section title="Display name">
          <Field>
            <TextInput
              value={displayName}
              onChangeText={onDisplayNameChange}
              placeholder="Your name"
              placeholderTextColor={tokens.color.textMuted}
              autoCapitalize="words"
              autoComplete="name"
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: tokens.color.textPrimary,
              }}
            />
          </Field>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 6 }}>
            This is how your family will see you.
          </Text>
        </Section>

        {/* Birthday */}
        <Section title="Birthday">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <DateBox
              flex={1}
              label="MM"
              value={bMonth}
              onChange={(v) => onBirthdayPartChange('m', v)}
              maxLength={2}
            />
            <DateBox
              flex={1}
              label="DD"
              value={bDay}
              onChange={(v) => onBirthdayPartChange('d', v)}
              maxLength={2}
            />
            <DateBox
              flex={1.4}
              label="YYYY"
              value={bYear}
              onChange={(v) => onBirthdayPartChange('y', v)}
              maxLength={4}
            />
          </View>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 6 }}>
            Used for birthday vault releases and age-aware prompts. Only your family sees it.
          </Text>
        </Section>

        {/* Role */}
        <Section title="Your family role">
          <Text
            style={{
              fontSize: 12,
              color: tokens.color.textMuted,
              lineHeight: 18,
              marginTop: -8,
              marginBottom: 4,
              paddingHorizontal: 4,
            }}
          >
            Helps FamLink personalize prompts ("Mom, tell us about…" vs "Grandpa,
            tell us about…") and decide whether to show you Ask or Answer mode.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {ROLE_CHIPS.map((chip) => (
              <ProfileRoleTile
                key={chip.id}
                chip={chip}
                active={chipIdFor(profile?.role ?? null, profile?.gender ?? null) === chip.id}
                onPress={() => onRoleChipChange(chip.id)}
              />
            ))}
          </View>
        </Section>

        {/* Membership */}
        <Section title="Membership">
          <Pressable
            onPress={() => router.push('/billing')}
            style={({ pressed }) => ({
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 22 }}>💖</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: tokens.color.textPrimary,
                }}
              >
                {membershipLabel(subscription)}
              </Text>
              <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
                {membershipSub(subscription)}
              </Text>
            </View>
            <Text style={{ fontSize: 20, color: tokens.color.textMuted }}>›</Text>
          </Pressable>
        </Section>

        {/* Danger / account zone */}
        <View style={{ gap: 12, marginTop: 12 }}>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => ({
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              opacity: pressed ? 0.7 : 1,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 15 }}>
              Sign out
            </Text>
          </Pressable>
          <Pressable
            onPress={() => comingSoon('settings_row')}
            style={({ pressed }) => ({
              paddingVertical: 10,
              alignItems: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={{ color: tokens.color.textMuted, fontSize: 13 }}>
              Delete my account — coming soon
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---- Sub-components -------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.3,
          color: tokens.color.textMuted,
        }}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Field({ children }: { children: React.ReactNode }) {
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

function ProfileRoleTile({
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
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderWidth: 2,
        borderColor: active ? tokens.color.accentPrimary : tokens.color.borderSubtle,
        opacity: pressed ? 0.85 : 1,
        alignItems: 'center',
        gap: 4,
      })}
    >
      <Text style={{ fontSize: 28 }}>{chip.glyph}</Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: active ? tokens.color.accentPrimary : tokens.color.textPrimary,
        }}
      >
        {chip.label}
      </Text>
    </Pressable>
  );
}

function PhotoAvatar({ url }: { url: string }) {
  return (
    <Image
      source={{ uri: url }}
      style={{
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 2,
        borderColor: tokens.color.accentSecondary,
        backgroundColor: tokens.color.bgTinted,
      }}
    />
  );
}

function InitialsAvatar({ name }: { name: string }) {
  const initials = initialsOf(name);
  return (
    <View
      style={{
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: tokens.color.bgTinted,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: tokens.color.accentSecondary,
      }}
    >
      <Text
        style={{
          fontSize: 38,
          fontWeight: '700',
          color: tokens.color.accentPrimary,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

// ---- Helpers --------------------------------------------------------------

function membershipLabel(sub: MySubscription | null): string {
  if (!sub) return 'Membership';
  switch (sub.status) {
    case 'f_and_f':
      return 'Friends & Family — free';
    case 'active':
      return 'FamLink Pro — active';
    case 'trialing':
      return 'FamLink Pro — trial';
    case 'past_due':
      return 'Payment failed — fix now';
    case 'canceled':
      return 'Subscription canceled';
    case 'none':
    default:
      return 'Not subscribed yet';
  }
}

function membershipSub(sub: MySubscription | null): string {
  if (!sub || sub.status === 'none') return 'Tap to see pricing';
  if (sub.status === 'f_and_f') return 'Tap to manage or upgrade';
  if (sub.status === 'past_due' || sub.status === 'canceled') return 'Tap to update payment';
  if (sub.currentPeriodEnd) {
    try {
      const d = new Date(sub.currentPeriodEnd);
      if (!Number.isNaN(d.getTime())) {
        return `Renews ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    } catch {
      // fall through
    }
  }
  return 'Tap to manage';
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
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * vault/release — choose a recipient + an unlock condition, release the trail.
 *
 * Flow:
 *   1. Pick a recipient: family-circle member OR "invite by email"
 *   2. Pick a condition: now / on a date / when they join
 *   3. Confirm + submit → calls createRelease()
 *
 * Confirm dialog: "After this, they'll see everything you've added so far. You
 * can't take it back, only stop adding more."
 */
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  createRelease,
  listFamilyMembersForRelease,
  type FamilyMemberOption,
} from '../../lib/supabaseVault';

type Condition = 'now' | 'date' | 'on_join';
type RecipientKind = 'member' | 'email';

export default function ReleaseVaultScreen() {
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<FamilyMemberOption[] | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [recipientKind, setRecipientKind] = useState<RecipientKind>('member');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  // Vault is heavy content — default the picker to immediate family only.
  // Toggle reveals extended members for the rare case the user wants to
  // release to an aunt or cousin.
  const [includeExtended, setIncludeExtended] = useState(false);

  const [condition, setCondition] = useState<Condition>('now');
  const [unlockDateDraft, setUnlockDateDraft] = useState(''); // YYYY-MM-DD

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await listFamilyMembersForRelease();
        setMembers(list);
        if (list.length === 0) {
          // Nothing to pick — default to email mode.
          setRecipientKind('email');
        }
      } catch (e) {
        setMembersError(e instanceof Error ? e.message : 'Could not load family members.');
        setMembers([]);
        setRecipientKind('email');
      }
    })();
  }, []);

  // unlock_on_join + recipientKind='email' is the only valid combo for "on_join"
  useEffect(() => {
    if (condition === 'on_join' && recipientKind === 'member') {
      // Switch to email; "on join" only makes sense for not-yet-joined.
      setRecipientKind('email');
      setSelectedMemberId(null);
    }
  }, [condition, recipientKind]);

  // Default the picker to immediate family; extended is opt-in. If the user
  // has NO immediate family yet (likely on day-one), fall back to showing
  // everyone so the picker isn't mysteriously empty.
  const hasImmediate = useMemo(
    () => (members ?? []).some((m) => m.isImmediate),
    [members],
  );
  const hasExtendedAvailable = useMemo(
    () => (members ?? []).some((m) => !m.isImmediate),
    [members],
  );
  const visibleMembers = useMemo<FamilyMemberOption[] | null>(() => {
    if (!members) return null;
    if (includeExtended || !hasImmediate) return members;
    return members.filter((m) => m.isImmediate);
  }, [members, includeExtended, hasImmediate]);

  const canSubmit = (() => {
    if (submitting) return false;
    if (recipientKind === 'member' && !selectedMemberId) return false;
    if (recipientKind === 'email' && !isProbablyEmail(emailDraft)) return false;
    if (condition === 'date' && !isValidFutureDate(unlockDateDraft)) return false;
    return true;
  })();

  function summaryLine(): string {
    let recipient = 'someone';
    if (recipientKind === 'member' && selectedMemberId) {
      const m = members?.find((x) => x.userId === selectedMemberId);
      recipient = m?.displayName ?? 'a family member';
    } else if (recipientKind === 'email' && emailDraft.trim()) {
      recipient = emailDraft.trim();
    }
    if (condition === 'now') return `${recipient} will see your vault now.`;
    if (condition === 'date') return `${recipient} will see your vault on ${unlockDateDraft}.`;
    return `${recipient} will see your vault once they join FamLink.`;
  }

  async function onSubmit() {
    if (!canSubmit) return;
    Alert.alert(
      'Release your vault?',
      `After this, ${summaryLine()} You can't take it back, only stop adding more.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Release',
          style: 'default',
          onPress: () => {
            void doSubmit();
          },
        },
      ],
    );
  }

  async function doSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createRelease({
        recipientUserId: recipientKind === 'member' ? selectedMemberId ?? undefined : undefined,
        recipientEmail: recipientKind === 'email' ? emailDraft.trim() : undefined,
        unlockAt: condition === 'date' ? toIsoEndOfDay(unlockDateDraft) : undefined,
        unlockOnJoin: condition === 'on_join',
      });
      Alert.alert(
        'Released',
        condition === 'on_join'
          ? "They'll see it the moment they join."
          : condition === 'date'
            ? `They'll see it on ${unlockDateDraft}.`
            : 'They can see your vault now.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not create the release.');
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
          gap: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: tokens.color.bgPrimary,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 22, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: tokens.color.accentGold,
                letterSpacing: 1.5,
              }}
            >
              RELEASE VAULT
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '700', color: tokens.color.textPrimary }}>
              Send the whole trail
            </Text>
          </View>
        </View>

        {/* Step 1: Recipient */}
        <Section
          step="1"
          title="Who should see it?"
          subtitle="They'll get every entry you've added, in order."
        >
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 10,
              padding: 4,
              marginBottom: 10,
            }}
          >
            {(['member', 'email'] as const).map((id) => (
              <Pressable
                key={id}
                onPress={() => setRecipientKind(id)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  backgroundColor:
                    recipientKind === id ? tokens.color.bgPrimary : 'transparent',
                  borderRadius: 7,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color:
                      recipientKind === id ? tokens.color.textPrimary : tokens.color.textMuted,
                  }}
                >
                  {id === 'member' ? 'Family member' : 'Invite by email'}
                </Text>
              </Pressable>
            ))}
          </View>

          {recipientKind === 'member' ? (
            <MemberPicker
              members={visibleMembers}
              error={membersError}
              selectedId={selectedMemberId}
              onPick={setSelectedMemberId}
              hasExtended={hasExtendedAvailable}
              includeExtended={includeExtended}
              onToggleExtended={(v) => {
                setIncludeExtended(v);
                // If turning off extended and the current pick is extended, clear it.
                if (!v) {
                  const cur = members?.find((m) => m.userId === selectedMemberId);
                  if (cur && !cur.isImmediate) {
                    setSelectedMemberId(null);
                  }
                }
              }}
            />
          ) : (
            <TextInput
              value={emailDraft}
              onChangeText={setEmailDraft}
              placeholder="their@email.com"
              placeholderTextColor={tokens.color.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 16,
                color: tokens.color.textPrimary,
              }}
            />
          )}
        </Section>

        {/* Step 2: Condition */}
        <Section step="2" title="When should it unlock?">
          <View style={{ gap: 8 }}>
            <ConditionOption
              selected={condition === 'now'}
              onPress={() => setCondition('now')}
              title="Release now"
              subtitle="They'll see it the next time they open FamLink."
            />
            <ConditionOption
              selected={condition === 'date'}
              onPress={() => setCondition('date')}
              title="Release on a specific date"
              subtitle="e.g. her 18th birthday, the day after the hearing."
            >
              {condition === 'date' && (
                <TextInput
                  value={unlockDateDraft}
                  onChangeText={setUnlockDateDraft}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={tokens.color.textMuted}
                  autoCapitalize="none"
                  style={{
                    marginTop: 10,
                    backgroundColor: tokens.color.bgPrimary,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: tokens.color.borderSubtle,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 15,
                    color: tokens.color.textPrimary,
                  }}
                />
              )}
            </ConditionOption>
            <ConditionOption
              selected={condition === 'on_join'}
              onPress={() => setCondition('on_join')}
              title="Release when they join FamLink"
              subtitle="Best for someone who isn't on the app yet."
              disabled={recipientKind === 'member'}
            />
          </View>
        </Section>

        {submitError && (
          <Text style={{ color: tokens.color.danger, fontSize: 13 }}>{submitError}</Text>
        )}

        {/* Submit */}
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => ({
            backgroundColor: canSubmit ? tokens.color.accentPrimary : tokens.color.borderStrong,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed && canSubmit ? 0.85 : 1,
          })}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
            {submitting ? 'Releasing...' : 'Release vault'}
          </Text>
        </Pressable>

        <Text
          style={{
            fontSize: 12,
            color: tokens.color.textMuted,
            textAlign: 'center',
            lineHeight: 18,
          }}
        >
          You can revoke a release later, but you can't make it un-seen.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---- Subcomponents ----------------------------------------------------------

function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: tokens.color.bgTinted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 13 }}>
            {step}
          </Text>
        </View>
        <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
          {title}
        </Text>
      </View>
      {subtitle && (
        <Text
          style={{
            fontSize: 13,
            color: tokens.color.textMuted,
            marginLeft: 36,
            marginTop: -6,
            lineHeight: 18,
          }}
        >
          {subtitle}
        </Text>
      )}
      <View>{children}</View>
    </View>
  );
}

function MemberPicker({
  members,
  error,
  selectedId,
  onPick,
  hasExtended,
  includeExtended,
  onToggleExtended,
}: {
  members: FamilyMemberOption[] | null;
  error: string | null;
  selectedId: string | null;
  onPick: (id: string) => void;
  hasExtended: boolean;
  includeExtended: boolean;
  onToggleExtended: (next: boolean) => void;
}) {
  if (error) {
    return (
      <View
        style={{
          backgroundColor: tokens.color.bgPrimary,
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
        }}
      >
        <Text style={{ color: tokens.color.danger, fontSize: 13 }}>{error}</Text>
      </View>
    );
  }
  if (members === null) {
    return (
      <View style={{ paddingVertical: 12, alignItems: 'center' }}>
        <ActivityIndicator color={tokens.color.accentPrimary} />
      </View>
    );
  }
  if (members.length === 0) {
    return (
      <View
        style={{
          backgroundColor: tokens.color.bgPrimary,
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
        }}
      >
        <Text style={{ color: tokens.color.textMuted, fontSize: 13 }}>
          You don't have any other family members in your circle yet. Use "Invite by email" instead
          — they'll see your vault once they join.
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      {members.map((m) => {
        const selected = selectedId === m.userId;
        return (
          <Pressable
            key={m.userId}
            onPress={() => onPick(m.userId)}
            style={({ pressed }) => ({
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 12,
              padding: 14,
              borderWidth: 2,
              borderColor: selected ? tokens.color.accentPrimary : tokens.color.borderSubtle,
              opacity: pressed ? 0.85 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            })}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: tokens.color.bgTinted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.accentPrimary }}>
                {m.displayName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={{ flex: 1, fontSize: 15, color: tokens.color.textPrimary }}>
              {m.displayName}
            </Text>
            {m.isImmediate && (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  backgroundColor: tokens.color.accentPrimary + '18',
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: tokens.color.accentPrimary,
                    fontWeight: '700',
                    letterSpacing: 0.4,
                  }}
                >
                  IMMEDIATE
                </Text>
              </View>
            )}
            {selected && (
              <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700' }}>✓</Text>
            )}
          </Pressable>
        );
      })}
      {hasExtended && (
        <View
          style={{
            marginTop: 6,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: tokens.color.bgTinted,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: tokens.color.textPrimary,
              }}
            >
              Include extended family
            </Text>
            <Text
              style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}
            >
              Aunts, cousins, in-laws. Most Vault releases stay in the inner ring.
            </Text>
          </View>
          <Switch
            value={includeExtended}
            onValueChange={onToggleExtended}
            trackColor={{ true: tokens.color.accentPrimary, false: '#D0CACC' }}
          />
        </View>
      )}
    </View>
  );
}

function ConditionOption({
  selected,
  onPress,
  title,
  subtitle,
  disabled,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        padding: 14,
        borderWidth: 2,
        borderColor: selected ? tokens.color.accentPrimary : tokens.color.borderSubtle,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: selected ? tokens.color.accentPrimary : tokens.color.borderStrong,
            backgroundColor: selected ? tokens.color.accentPrimary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>✓</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.color.textPrimary }}>
            {title}
          </Text>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
            {subtitle}
          </Text>
        </View>
      </View>
      {children}
    </Pressable>
  );
}

// ---- Tiny helpers -----------------------------------------------------------

function isProbablyEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function isValidFutureDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T23:59:59');
  return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
}

function toIsoEndOfDay(ymd: string): string {
  // Parse as local-time end-of-day so "her 18th birthday" doesn't fire 24 hours early.
  const d = new Date(ymd + 'T23:59:59');
  return d.toISOString();
}

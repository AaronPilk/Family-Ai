import { useState, useMemo } from 'react';
import { router } from 'expo-router';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { MEMBERS, BRANCHES, ME, type MemberId, type VaultItem, type VaultMediaKind } from '../../lib/mockData';
import { useVaultStore } from '../../lib/vaultStore';
import { useScopedBranchIds } from '../../lib/branchStore';
import { Avatar } from '../../components/Avatar';

type ReleaseKind = 'on_date' | 'on_birthday' | 'on_age' | 'on_milestone' | 'after_death' | 'manual';

const MEDIA_OPTIONS: { id: VaultMediaKind; label: string; glyph: string }[] = [
  { id: 'voice', label: 'Voice', glyph: '🎤' },
  { id: 'video', label: 'Video', glyph: '🎥' },
  { id: 'text',  label: 'Letter', glyph: '✉️' },
  { id: 'money', label: 'Money', glyph: '$' },
];

const RELEASE_OPTIONS: { id: ReleaseKind; label: string; sub: string }[] = [
  { id: 'on_date',      label: 'A specific date',     sub: 'e.g. Jan 1, 2030' },
  { id: 'on_birthday',  label: 'Their birthday',      sub: 'Any year' },
  { id: 'on_age',       label: 'When they reach an age', sub: 'e.g. when Sara turns 18' },
  { id: 'on_milestone', label: 'A life milestone',    sub: 'First child, marriage, graduation' },
  { id: 'after_death',  label: 'After I pass',         sub: 'Verified by 2 family members' },
  { id: 'manual',       label: 'Manually, later',     sub: 'Release whenever you choose' },
];

export default function NewVaultItem() {
  const insets = useSafeAreaInsets();
  const addItem = useVaultStore((s) => s.addItem);
  const scopedIds = useScopedBranchIds();

  // Recipients pool: union of in-scope branch members (excluding 'me')
  const recipientPool = useMemo(() => {
    const ids = new Set<MemberId>();
    scopedIds.forEach((bid) => BRANCHES[bid].memberIds.forEach((m) => ids.add(m)));
    return Array.from(ids);
  }, [scopedIds]);

  const [title, setTitle] = useState('');
  const [media, setMedia] = useState<VaultMediaKind>('voice');
  const [recipients, setRecipients] = useState<MemberId[]>([]);
  const [release, setRelease] = useState<ReleaseKind>('on_date');
  const [releaseDetail, setReleaseDetail] = useState('');
  const [amount, setAmount] = useState('');

  function toggleRecipient(id: MemberId) {
    setRecipients((cur) => (cur.includes(id) ? cur.filter((r) => r !== id) : [...cur, id]));
  }

  function releaseSummary(): string {
    switch (release) {
      case 'on_date':      return releaseDetail ? `Releases on ${releaseDetail}` : 'Releases on a date';
      case 'on_birthday':  return releaseDetail ? `Releases on ${releaseDetail}'s birthday` : 'Releases on their birthday';
      case 'on_age':       return releaseDetail ? `Releases when ${releaseDetail}` : 'Releases at age N';
      case 'on_milestone': return releaseDetail ? `Releases on ${releaseDetail}` : 'Releases on a milestone';
      case 'after_death':  return 'Releases after my passing (verified)';
      case 'manual':       return 'Sealed until you release it';
    }
  }

  function handleSave() {
    if (!title.trim() || recipients.length === 0) return;
    const id = `v-${Date.now().toString(36)}`;
    const newItem: VaultItem = {
      id,
      creatorId: ME,
      title: title.trim(),
      releaseText: releaseSummary(),
      recipientIds: recipients,
      mediaKind: media,
      durationSec: media === 'voice' || media === 'video' ? 60 : undefined,
      amountUsd: media === 'money' ? Number(amount.replace(/[^0-9]/g, '')) || 0 : undefined,
      status: release === 'after_death' ? 'sealed' : 'scheduled',
    };
    addItem(newItem);
    router.replace('/(tabs)/vault');
  }

  const canSave = title.trim().length > 0 && recipients.length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header insets={insets} title="New Vault item" />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 22 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: tokens.color.textPrimary }}>
            Leave a message for the future
          </Text>
          <Text style={{ fontSize: 15, color: tokens.color.textSecondary, lineHeight: 22 }}>
            Sealed until your release rule fires. The recipient gets a gentle notification when it's time.
          </Text>
        </View>

        <Field label="WHAT'S IT CALLED?">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. For Sara on her wedding day"
            placeholderTextColor={tokens.color.textMuted}
            style={{ fontSize: 17, color: tokens.color.textPrimary, fontWeight: '500' }}
          />
        </Field>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
            FORMAT
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {MEDIA_OPTIONS.map((m) => {
              const active = media === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMedia(m.id)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: active ? tokens.color.bgTinted : tokens.color.bgPrimary,
                    borderWidth: 1.5,
                    borderColor: active ? tokens.color.accentPrimary : tokens.color.borderSubtle,
                    alignItems: 'center',
                    gap: 4,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 20 }}>{m.glyph}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.color.textPrimary }}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {media === 'money' && (
          <Field label="AMOUNT (USD)">
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="25000"
              placeholderTextColor={tokens.color.textMuted}
              keyboardType="number-pad"
              style={{ fontSize: 22, color: tokens.color.textPrimary, fontWeight: '700' }}
            />
          </Field>
        )}

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
            FOR WHOM?
          </Text>
          <View style={{ gap: 8 }}>
            {recipientPool.map((id) => {
              const m = MEMBERS[id];
              const included = recipients.includes(id);
              return (
                <Pressable
                  key={id}
                  onPress={() => toggleRecipient(id)}
                  style={({ pressed }) => ({
                    padding: 12,
                    backgroundColor: included ? tokens.color.bgTinted : tokens.color.bgPrimary,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: included ? tokens.color.accentPrimary : tokens.color.borderSubtle,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Avatar member={m} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.color.textPrimary }}>
                      {m.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
                      {id === ME ? 'You' : m.relationship}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: included ? tokens.color.accentPrimary : 'transparent',
                      borderWidth: 2,
                      borderColor: included ? tokens.color.accentPrimary : tokens.color.borderStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {included && <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
            WHEN SHOULD IT RELEASE?
          </Text>
          <View style={{ gap: 8 }}>
            {RELEASE_OPTIONS.map((opt) => {
              const active = release === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setRelease(opt.id)}
                  style={({ pressed }) => ({
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: active ? tokens.color.bgTinted : tokens.color.bgPrimary,
                    borderWidth: 1.5,
                    borderColor: active ? tokens.color.accentPrimary : tokens.color.borderSubtle,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.color.textPrimary }}>
                    {opt.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 4 }}>
                    {opt.sub}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {release !== 'manual' && release !== 'after_death' && (
            <Field label="DETAIL">
              <TextInput
                value={releaseDetail}
                onChangeText={setReleaseDetail}
                placeholder={
                  release === 'on_date'
                    ? 'Jan 1, 2030'
                    : release === 'on_birthday'
                      ? "e.g. Sara's birthday"
                      : release === 'on_age'
                        ? "Sara turns 18"
                        : "first child / marriage / graduation"
                }
                placeholderTextColor={tokens.color.textMuted}
                style={{ fontSize: 16, color: tokens.color.textPrimary }}
              />
            </Field>
          )}
        </View>

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={({ pressed }) => ({
            backgroundColor: canSave ? tokens.color.accentPrimary : '#D8C7CC',
            height: 56,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>
            Seal it
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
      <Text style={{ fontSize: 11, color: tokens.color.textMuted, marginBottom: 4, fontWeight: '700' }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Header({ insets, title }: { insets: { top: number }; title: string }) {
  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: tokens.color.bgSecondary,
      }}
    >
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
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <Text style={{ fontSize: 20, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
      </Pressable>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
        {title}
      </Text>
    </View>
  );
}

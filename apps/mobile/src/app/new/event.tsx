import { useState, useMemo, useEffect } from 'react';
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
import {
  BRANCHES,
  MEMBERS,
  EXTENDED_MEMBERS,
  ME,
  type MemberId,
  type ExtendedMemberId,
  type AnyMemberId,
  type BranchId,
  type EventKind,
  type FamilyEvent,
  type EventGuest,
} from '../../lib/mockData';
import { useVisibleBranches } from '../../lib/branchStore';
import { useEventStore } from '../../lib/eventStore';
import { Avatar } from '../../components/Avatar';

const KIND_OPTIONS: { id: EventKind; label: string; glyph: string; tint: string }[] = [
  { id: 'reunion', label: 'Family reunion', glyph: '🌾', tint: '#E8B274' },
  { id: 'vacation', label: 'Vacation', glyph: '🏖', tint: '#9BC7E4' },
  { id: 'holiday', label: 'Holiday', glyph: '🎄', tint: '#C0345C' },
  { id: 'gathering', label: 'Get-together', glyph: '🎉', tint: '#9BC97A' },
  { id: 'other', label: 'Something else', glyph: '✨', tint: '#C09155' },
];

const COVER_GLYPHS = ['🌾', '🏖', '🍂', '🎄', '🎂', '✈️', '🍷', '🏕', '🎉', '⛵️', '🌻', '🏔'];

export default function NewEvent() {
  const insets = useSafeAreaInsets();
  const visible = useVisibleBranches();
  const addEvent = useEventStore((s) => s.addEvent);

  const [kind, setKind] = useState<EventKind>('reunion');
  const [title, setTitle] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [glyph, setGlyph] = useState(COVER_GLYPHS[0]!);
  const [selectedBranches, setSelectedBranches] = useState<BranchId[]>(
    visible.length > 0 ? [visible[0]!.id] : ['pilks'],
  );
  // Default invites = all members of the selected branches.
  const branchMemberIds = useMemo(
    () =>
      Array.from(new Set(selectedBranches.flatMap((bid) => BRANCHES[bid].memberIds))) as MemberId[],
    [selectedBranches],
  );
  // Reunion mode: also offer extended-family invites scoped to picked branches.
  const extendedPool: ExtendedMemberId[] = useMemo(
    () =>
      Object.values(EXTENDED_MEMBERS)
        .filter((m) => selectedBranches.includes(m.branchId))
        .map((m) => m.id),
    [selectedBranches],
  );

  const [invitedCore, setInvitedCore] = useState<MemberId[]>(branchMemberIds);
  const [invitedExt, setInvitedExt] = useState<ExtendedMemberId[]>([]);

  // Keep core invites in sync when branches change (additive — don't unselect manual ones).
  useEffect(() => {
    setInvitedCore((cur) => Array.from(new Set([...cur, ...branchMemberIds])));
  }, [branchMemberIds]);

  function toggleBranch(b: BranchId) {
    setSelectedBranches((cur) =>
      cur.includes(b) ? (cur.length > 1 ? cur.filter((x) => x !== b) : cur) : [...cur, b],
    );
  }

  function toggleCore(id: MemberId) {
    if (id === ME) return;
    setInvitedCore((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function toggleExt(id: ExtendedMemberId) {
    setInvitedExt((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  const canSave =
    title.trim().length > 0 && dateRange.trim().length > 0 && selectedBranches.length > 0;

  function handleSave() {
    if (!canSave) return;
    const id = `e-${Date.now().toString(36)}`;
    const guests: EventGuest[] = [
      { memberId: ME, rsvp: 'going' },
      ...invitedCore
        .filter((m) => m !== ME)
        .map((m) => ({ memberId: m, rsvp: 'invited' as const })),
      ...invitedExt.map((m) => ({
        memberId: m,
        rsvp: 'invited' as const,
        pendingInvite: true,
      })),
    ];
    const kindMeta = KIND_OPTIONS.find((k) => k.id === kind)!;
    const newEvent: FamilyEvent = {
      id,
      branchIds: selectedBranches,
      kind,
      title: title.trim(),
      subtitle: `Planned by you · ${selectedBranches.map((b) => BRANCHES[b].shortName).join(' + ')}`,
      dateRangeText: dateRange.trim(),
      startsAt: startsAt.trim() || new Date().toISOString().slice(0, 10),
      endsAt: endsAt.trim() || startsAt.trim() || new Date().toISOString().slice(0, 10),
      status: 'planning',
      coverTint: kindMeta.tint,
      coverGlyph: glyph,
      locationText: location.trim() || undefined,
      organizerId: ME,
      guests,
      bringList: [],
      polls: {},
      activity: [
        {
          id: 'a-init',
          authorId: ME,
          body: `Created this ${kindMeta.label.toLowerCase()}.`,
          whenAgo: 'just now',
        },
      ],
      photos: [],
    };
    addEvent(newEvent);
    router.replace(`/moment/${id}`);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header insets={insets} title="New event" />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
          gap: 22,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 28, fontWeight: '700', color: tokens.color.textPrimary }}>
          Get the family together
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: tokens.color.textSecondary,
            lineHeight: 22,
            marginTop: -10,
          }}
        >
          Invite everyone, lock in the dates and place, share what you're bringing. After it, Kin
          stitches a highlight reel from everything you posted.
        </Text>

        {/* Kind picker */}
        <Section label="WHAT KIND OF EVENT?">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {KIND_OPTIONS.map((k) => {
              const active = kind === k.id;
              return (
                <Pressable
                  key={k.id}
                  onPress={() => setKind(k.id)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: active ? tokens.color.bgTinted : tokens.color.bgPrimary,
                    borderWidth: 1.5,
                    borderColor: active ? tokens.color.accentPrimary : tokens.color.borderSubtle,
                    opacity: pressed ? 0.7 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  })}
                >
                  <Text style={{ fontSize: 18 }}>{k.glyph}</Text>
                  <Text
                    style={{ fontSize: 14, fontWeight: '600', color: tokens.color.textPrimary }}
                  >
                    {k.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Field label="WHAT'S IT CALLED?">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Pilks Family Reunion 2026"
            placeholderTextColor={tokens.color.textMuted}
            style={{ fontSize: 18, color: tokens.color.textPrimary, fontWeight: '500' }}
          />
        </Field>

        <Field label="DATES (text)">
          <TextInput
            value={dateRange}
            onChangeText={setDateRange}
            placeholder="e.g. Jul 17 – 20, 2026"
            placeholderTextColor={tokens.color.textMuted}
            style={{ fontSize: 16, color: tokens.color.textPrimary }}
          />
        </Field>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="STARTS (YYYY-MM-DD)">
              <TextInput
                value={startsAt}
                onChangeText={setStartsAt}
                placeholder="2026-07-17"
                placeholderTextColor={tokens.color.textMuted}
                style={{ fontSize: 15, color: tokens.color.textPrimary }}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="ENDS (YYYY-MM-DD)">
              <TextInput
                value={endsAt}
                onChangeText={setEndsAt}
                placeholder="2026-07-20"
                placeholderTextColor={tokens.color.textMuted}
                style={{ fontSize: 15, color: tokens.color.textPrimary }}
              />
            </Field>
          </View>
        </View>

        <Field label="WHERE?">
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Aunt Susan's place, Hudson Valley NY"
            placeholderTextColor={tokens.color.textMuted}
            style={{ fontSize: 15, color: tokens.color.textPrimary }}
          />
        </Field>

        {/* Cover glyph */}
        <Section label="COVER">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {COVER_GLYPHS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGlyph(g)}
                style={({ pressed }) => ({
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor:
                    g === glyph ? tokens.color.accentPrimary + '15' : tokens.color.bgPrimary,
                  borderWidth: 1.5,
                  borderColor: g === glyph ? tokens.color.accentPrimary : tokens.color.borderSubtle,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 22 }}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Branch picker (multi-select for cross-branch reunions) */}
        {visible.length > 1 && (
          <Section label="WHICH FAMILIES? (PICK ONE OR BOTH)">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {visible.map((b) => {
                const active = selectedBranches.includes(b.id);
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => toggleBranch(b.id)}
                    style={({ pressed }) => ({
                      flex: 1,
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: active ? tokens.color.bgTinted : tokens.color.bgPrimary,
                      borderWidth: 1.5,
                      borderColor: active ? b.color : tokens.color.borderSubtle,
                      opacity: pressed ? 0.7 : 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    })}
                  >
                    <View
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: b.color }}
                    />
                    <Text
                      style={{ fontSize: 14, fontWeight: '600', color: tokens.color.textPrimary }}
                    >
                      {b.shortName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedBranches.length > 1 && (
              <Text
                style={{
                  fontSize: 12,
                  color: tokens.color.warning,
                  marginTop: 6,
                  lineHeight: 18,
                }}
              >
                Cross-branch event — both families will see this one. Photos and chatter stay scoped
                to this event, not your branches' timelines.
              </Text>
            )}
          </Section>
        )}

        {/* Immediate family invites */}
        <Section label="IMMEDIATE FAMILY">
          <View style={{ gap: 8 }}>
            {branchMemberIds.map((id) => {
              const m = MEMBERS[id];
              const included = invitedCore.includes(id);
              const isYou = id === ME;
              return (
                <Pressable
                  key={id}
                  onPress={() => toggleCore(id)}
                  disabled={isYou}
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
                    <Text
                      style={{ fontSize: 14, fontWeight: '600', color: tokens.color.textPrimary }}
                    >
                      {m.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
                      {isYou ? 'You (always in)' : m.relationship}
                    </Text>
                  </View>
                  <Checkbox checked={included} />
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Extended family invites (only meaningful for reunions/big gatherings) */}
        {extendedPool.length > 0 &&
          (kind === 'reunion' || kind === 'gathering' || kind === 'holiday') && (
            <Section label="EXTENDED FAMILY & GUESTS">
              <Text
                style={{
                  fontSize: 12,
                  color: tokens.color.textMuted,
                  lineHeight: 18,
                  marginBottom: 6,
                }}
              >
                Cousins, aunts, uncles, in-laws, family friends. They get an invite even if they
                haven't installed Kin yet.
              </Text>
              <View style={{ gap: 8 }}>
                {extendedPool.map((id) => {
                  const m = EXTENDED_MEMBERS[id];
                  const included = invitedExt.includes(id);
                  return (
                    <Pressable
                      key={id}
                      onPress={() => toggleExt(id)}
                      style={({ pressed }) => ({
                        padding: 12,
                        backgroundColor: included ? tokens.color.bgTinted : tokens.color.bgPrimary,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: included
                          ? tokens.color.accentPrimary
                          : tokens.color.borderSubtle,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Avatar member={m} size="sm" />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: tokens.color.textPrimary,
                          }}
                        >
                          {m.name}
                        </Text>
                        <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
                          {m.relationship}
                        </Text>
                      </View>
                      <Checkbox checked={included} />
                    </Pressable>
                  );
                })}
              </View>
            </Section>
          )}

        {/* Save */}
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
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>Create event</Text>
        </Pressable>
        <Text
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: tokens.color.textMuted,
            marginTop: -10,
            lineHeight: 18,
          }}
        >
          SMS invites via Twilio land in a later batch. For now invitees get a push notification and
          a shareable link.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: checked ? tokens.color.accentPrimary : 'transparent',
        borderWidth: 2,
        borderColor: checked ? tokens.color.accentPrimary : tokens.color.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked && <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✓</Text>}
    </View>
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
      <Text
        style={{ fontSize: 11, color: tokens.color.textMuted, marginBottom: 4, fontWeight: '700' }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
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

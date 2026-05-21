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
import {
  BRANCHES,
  MEMBERS,
  ME,
  type MemberId,
  type BranchId,
  type FamilyMoment,
} from '../../lib/mockData';
import { useVisibleBranches, useWritableBranchId } from '../../lib/branchStore';
import { useMomentStore } from '../../lib/momentStore';
import { Avatar } from '../../components/Avatar';

const GLYPHS = ['🏔', '🏖', '🍂', '🎄', '🎂', '✈️', '🍷', '🏕', '🎉', '⛵️'];

export default function NewMoment() {
  const insets = useSafeAreaInsets();
  const visible = useVisibleBranches();
  const writable = useWritableBranchId();
  const addMoment = useMomentStore((s) => s.addMoment);

  // If the user is in the "All my family" scope, force them to pick a concrete
  // branch — Moments need a single owning branch. (Codex H-M2 — prevent silent
  // writes to a synthetic branch.)
  const initialBranch: BranchId = (writable ?? visible[0]?.id ?? 'pilks') as BranchId;

  const [title, setTitle] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [glyph, setGlyph] = useState(GLYPHS[0]!);
  const [branchId, setBranchId] = useState<BranchId>(initialBranch);
  const branchMemberIds = BRANCHES[branchId].memberIds;
  const [invited, setInvited] = useState<MemberId[]>(branchMemberIds);

  // Update invitees when branch changes
  const branchMembers = useMemo(() => branchMemberIds, [branchMemberIds]);

  function toggleInvite(id: MemberId) {
    if (id === ME) return; // you're always in
    setInvited((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function handleSave() {
    if (!title.trim() || !dateRange.trim()) return;
    const id = `m-${Date.now().toString(36)}`;
    const newMoment: FamilyMoment = {
      id,
      branchId,
      title: title.trim(),
      subtitle: `Planned by you · ${BRANCHES[branchId].shortName}`,
      status: 'planning',
      dateRangeText: dateRange.trim(),
      coverTint: '#FFE3EA',
      coverGlyph: glyph,
      organizerId: ME,
      participantIds: Array.from(new Set([ME, ...invited])),
      datePoll: [],
      locationPoll: [],
      packingList: [],
      activity: [{ id: 'a-init', authorId: ME, body: 'Created this Moment.', whenAgo: 'just now' }],
    };
    addMoment(newMoment);
    router.replace(`/moment/${id}`);
  }

  const canSave = title.trim().length > 0 && dateRange.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header insets={insets} title="New Moment" />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
          gap: 22,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 28, fontWeight: '700', color: tokens.color.textPrimary }}>
          Plan something together
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: tokens.color.textSecondary,
            lineHeight: 22,
            marginTop: -10,
          }}
        >
          Family votes on dates and places. Everyone's photos collect here during the event. After
          it, the whole thing becomes a chapter.
        </Text>

        <Field label="WHAT'S IT CALLED?">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Tahoe family week"
            placeholderTextColor={tokens.color.textMuted}
            style={{ fontSize: 18, color: tokens.color.textPrimary, fontWeight: '500' }}
          />
        </Field>

        <Field label="WHEN?">
          <TextInput
            value={dateRange}
            onChangeText={setDateRange}
            placeholder="e.g. Aug 14 – 21, 2026"
            placeholderTextColor={tokens.color.textMuted}
            style={{ fontSize: 16, color: tokens.color.textPrimary }}
          />
        </Field>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
            COVER
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {GLYPHS.map((g) => (
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
        </View>

        {visible.length > 1 && (
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
              WHICH FAMILY?
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {visible.map((b) => {
                const active = b.id === branchId;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      setBranchId(b.id);
                      setInvited(BRANCHES[b.id].memberIds);
                    }}
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
          </View>
        )}

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
            WHO'S INVITED?
          </Text>
          <View style={{ gap: 8 }}>
            {branchMembers.map((id) => {
              const m = MEMBERS[id];
              const included = invited.includes(id);
              const isYou = id === ME;
              return (
                <Pressable
                  key={id}
                  onPress={() => toggleInvite(id)}
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
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: included ? tokens.color.accentPrimary : 'transparent',
                      borderWidth: 2,
                      borderColor: included
                        ? tokens.color.accentPrimary
                        : tokens.color.borderStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {included && (
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✓</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
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
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>Create Moment</Text>
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
      <Text
        style={{ fontSize: 11, color: tokens.color.textMuted, marginBottom: 4, fontWeight: '700' }}
      >
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

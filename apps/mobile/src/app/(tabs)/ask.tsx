import { useState, useMemo, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View, Text, Pressable, TextInput } from 'react-native';
import { comingSoon } from '../../lib/comingSoon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { SUGGESTED_QUESTIONS, MEMBERS, BRANCHES, type MemberId } from '../../lib/mockData';
import {
  useCurrentBranch,
  useIsMultiBranch,
  useScopedBranchIds,
  useSelection,
} from '../../lib/branchStore';
import { Avatar } from '../../components/Avatar';
import { BranchSwitcher } from '../../components/BranchSwitcher';

export default function AskScreen() {
  const insets = useSafeAreaInsets();
  const branch = useCurrentBranch();
  const sel = useSelection();
  const isMulti = useIsMultiBranch();
  const scopedIds = useScopedBranchIds();
  const params = useLocalSearchParams<{ preselect?: MemberId }>();

  // Members across all in-scope branches (deduped, excluding 'me'). With the
  // mock-data exports emptied, MEMBERS entries for non-'me' ids carry blank
  // names — filter those out so we don't render ghost chips.
  const branchMembers = useMemo(() => {
    const ids = new Set<MemberId>();
    scopedIds.forEach((bid) => BRANCHES[bid].memberIds.forEach((m) => m !== 'me' && ids.add(m)));
    return Array.from(ids)
      .map((id) => MEMBERS[id])
      .filter((m) => m && m.name && m.name.length > 0);
  }, [scopedIds]);
  const [selected, setSelected] = useState<MemberId | null>(
    (params.preselect as MemberId) ?? branchMembers[0]?.id ?? null,
  );
  const [draft, setDraft] = useState('');

  // Honor `?preselect=` whenever it changes (e.g. user taps Ask from another profile)
  useEffect(() => {
    if (params.preselect && branchMembers.find((m) => m.id === params.preselect)) {
      setSelected(params.preselect as MemberId);
    }
  }, [params.preselect, branchMembers]);

  // Reset selection when branch changes and current selection is no longer in scope
  useEffect(() => {
    if (selected && !branchMembers.find((m) => m.id === selected)) {
      setSelected(branchMembers[0]?.id ?? null);
    }
  }, [selected, branchMembers]);

  const suggested = SUGGESTED_QUESTIONS.filter((s) => scopedIds.includes(s.branchId));

  function handleSuggestedTap(s: { ask: MemberId; text: string }) {
    setSelected(s.ask);
    setDraft(s.text);
  }

  function handleSend() {
    if (!selected || !draft.trim()) return;
    comingSoon('send_question');
    // After "send", clear and pop back to Home so the demo feels alive
    setDraft('');
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 22,
        }}
      >
        <View style={{ gap: 10 }}>
          <BranchSwitcher />
          <Text style={{ fontSize: 28, fontWeight: '700', color: tokens.color.textPrimary }}>
            Ask
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: tokens.color.textSecondary,
              lineHeight: 22,
            }}
          >
            Pick someone{' '}
            {isMulti
              ? sel === 'all'
                ? 'across your family'
                : `in ${branch.shortName}`
              : 'in your family'}{' '}
            and ask them anything. They'll get a gentle nudge.
          </Text>
        </View>

        {/* Empty state when there's no one to ask yet */}
        {branchMembers.length === 0 && (
          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              padding: 24,
              borderRadius: 18,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 32 }}>👋</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.color.textPrimary }}>
              Invite family first
            </Text>
            <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
              Once family members join, you can ask them one good question a day — and their answers
              live forever in your timeline and theirs.
            </Text>
            <Pressable
              onPress={() => router.push('/invite')}
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                marginTop: 6,
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: tokens.color.accentPrimary,
                borderRadius: 999,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>+ Invite family</Text>
            </Pressable>
          </View>
        )}

        {/* Recipient picker */}
        {branchMembers.length > 0 && (
        <Section title="Who do you want to ask?">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
          >
            {branchMembers.map((m) => {
              const isSel = m.id === selected;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setSelected(m.id)}
                  style={{
                    width: 92,
                    paddingVertical: 14,
                    backgroundColor: isSel ? tokens.color.bgTinted : tokens.color.bgPrimary,
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: isSel ? tokens.color.accentPrimary : tokens.color.borderSubtle,
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Avatar member={m} size="md" />
                  <Text style={{ fontSize: 13, fontWeight: '600' }}>{m.relationship}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>
        )}

        {/* Composer */}
        {branchMembers.length > 0 && selected && (
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 20,
              padding: 16,
              gap: 14,
              shadowColor: '#1A1418',
              shadowOpacity: 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            <Text style={{ fontSize: 14, color: tokens.color.textMuted }}>
              Asking{' '}
              <Text style={{ fontWeight: '700', color: tokens.color.accentPrimary }}>
                {MEMBERS[selected].name}
              </Text>
            </Text>
            <View
              style={{
                backgroundColor: tokens.color.bgSecondary,
                borderRadius: 14,
                padding: 14,
                minHeight: 100,
              }}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Type your question, or tap the mic to ask out loud…"
                placeholderTextColor={tokens.color.textMuted}
                multiline
                style={{
                  color: tokens.color.textPrimary,
                  fontSize: 16,
                  lineHeight: 22,
                  minHeight: 72,
                  textAlignVertical: 'top',
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ComposerAction label="🎤  Voice" onPress={() => comingSoon('record_voice')} />
              <ComposerAction label="📷  Photo" onPress={() => comingSoon('attach_photo')} />
              <ComposerAction label="🎥  Video" onPress={() => comingSoon('record_video')} />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim()}
              style={({ pressed }) => ({
                backgroundColor: draft.trim() ? tokens.color.accentPrimary : '#D8C7CC',
                opacity: pressed ? 0.85 : 1,
                height: 52,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
                Send to {MEMBERS[selected].name}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Suggested — only render when there's something to suggest */}
        {suggested.length > 0 && (
        <Section title="Suggested questions">
          <View style={{ gap: 10 }}>
            {suggested.map((s, i) => (
              <Pressable
                key={i}
                onPress={() => handleSuggestedTap(s)}
                style={({ pressed }) => ({
                  backgroundColor: tokens.color.bgTinted,
                  padding: 14,
                  borderRadius: 14,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: tokens.color.accentPrimary,
                    fontWeight: '700',
                    marginBottom: 4,
                  }}
                >
                  ASK {MEMBERS[s.ask].relationship.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 16, color: tokens.color.textPrimary, lineHeight: 22 }}>
                  {s.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.textSecondary }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function ComposerAction({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: tokens.color.bgTinted,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.color.accentPrimary }}>
        {label}
      </Text>
    </Pressable>
  );
}

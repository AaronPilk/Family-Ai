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
  useUserRole,
} from '../../lib/branchStore';
import { Avatar } from '../../components/Avatar';
import { BranchSwitcher } from '../../components/BranchSwitcher';

/**
 * The Ask tab is now two surfaces in one. Younger users (children,
 * grandchildren) see the existing Ask flow — pick someone, type a question.
 * Elders (parents, grandparents) see a quick-entry into the Answer surface
 * because they're the ones with stories to tell. We expose a segmented
 * control at the top so anyone — regardless of their role flag — can
 * cross over and contribute to the family memory. The default is chosen
 * by `useUserRole()`; the user can override per-session.
 */
type Mode = 'ask' | 'answer';

export default function AskScreen() {
  const insets = useSafeAreaInsets();
  const branch = useCurrentBranch();
  const sel = useSelection();
  const isMulti = useIsMultiBranch();
  const scopedIds = useScopedBranchIds();
  const params = useLocalSearchParams<{ preselect?: MemberId; mode?: Mode }>();
  const userRole = useUserRole();
  // Default the surface to "answer" for elders, "ask" for everyone else.
  // The user can toggle either way per-session via the segmented control.
  const [mode, setMode] = useState<Mode>(
    params.mode ?? (userRole === 'elder' ? 'answer' : 'ask'),
  );

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
            {mode === 'answer' ? 'Answer' : 'Ask'}
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: tokens.color.textSecondary,
              lineHeight: 22,
            }}
          >
            {mode === 'answer'
              ? 'Share a memory with your family. One question at a time.'
              : `Pick someone ${
                  isMulti
                    ? sel === 'all'
                      ? 'across your family'
                      : `in ${branch.shortName}`
                    : 'in your family'
                } and ask them anything. They'll get a gentle nudge.`}
          </Text>
        </View>

        {/* Mode segmented control */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: tokens.color.bgTinted,
            borderRadius: 14,
            padding: 4,
          }}
        >
          {(['answer', 'ask'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                backgroundColor: mode === m ? tokens.color.bgPrimary : 'transparent',
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: mode === m ? tokens.color.textPrimary : tokens.color.textMuted,
                }}
              >
                {m === 'answer' ? 'Answer questions' : 'Ask family'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Answer mode — quick launcher into the full answering surface */}
        {mode === 'answer' && (
          <View style={{ gap: 14 }}>
            <Pressable
              onPress={() => router.push('/answer/today')}
              style={({ pressed }) => ({
                backgroundColor: tokens.color.accentPrimary,
                borderRadius: 24,
                padding: 22,
                opacity: pressed ? 0.9 : 1,
                shadowColor: tokens.color.accentPrimary,
                shadowOpacity: 0.25,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
              })}
            >
              <Text
                style={{
                  color: '#FFD8E0',
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1.5,
                }}
              >
                READY WHEN YOU ARE
              </Text>
              <Text
                style={{
                  color: 'white',
                  fontSize: 22,
                  fontWeight: '700',
                  lineHeight: 30,
                  marginTop: 8,
                }}
              >
                Answer your next question
              </Text>
              <Text style={{ marginTop: 10, color: '#FFD8E0', fontSize: 14, lineHeight: 20 }}>
                Tap in — we'll show you one good question. Type a few sentences
                and it'll live in your family's story forever.
              </Text>
              <View
                style={{
                  marginTop: 16,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Open →</Text>
              </View>
            </Pressable>
            <Text style={{ fontSize: 13, color: tokens.color.textMuted, lineHeight: 18 }}>
              Want to ask someone else a question instead? Switch to{' '}
              <Text
                onPress={() => setMode('ask')}
                style={{ color: tokens.color.accentPrimary, fontWeight: '700' }}
              >
                Ask family
              </Text>
              .
            </Text>
          </View>
        )}

        {/* Empty state when there's no one to ask yet */}
        {mode === 'ask' && branchMembers.length === 0 && (
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
        {mode === 'ask' && branchMembers.length > 0 && (
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
        {mode === 'ask' && branchMembers.length > 0 && selected && (
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
        {mode === 'ask' && suggested.length > 0 && (
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

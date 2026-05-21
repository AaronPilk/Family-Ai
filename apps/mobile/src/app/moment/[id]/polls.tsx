import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../theme/tokens';
import { ME, getAnyMember, rsvpCount, type PollOption } from '../../../lib/mockData';
import { useEvent, useEventStore } from '../../../lib/eventStore';
import { Avatar } from '../../../components/Avatar';
import { comingSoon } from '../../../lib/comingSoon';

export default function EventPolls() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const event = useEvent(id ?? '');
  const toggle = useEventStore((s) => s.togglePollVote);

  if (!event) return null;
  const totalVoters = rsvpCount(event, 'going') + rsvpCount(event, 'maybe') || 1;

  const polls = [
    { kind: 'date' as const, prompt: 'Pick the dates', options: event.polls.date },
    {
      kind: 'location' as const,
      prompt: 'Pick the place',
      options: event.polls.location,
      rich: true,
    },
    { kind: 'activity' as const, prompt: 'What do we do?', options: event.polls.activity },
  ].filter((p) => p.options && p.options.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 24,
        }}
      >
        <Header title="Polls" subtitle={event.title} />

        {polls.map((p) => (
          <Section key={p.kind} title={p.prompt}>
            <PollList
              options={p.options!}
              totalVoters={totalVoters}
              richCards={p.rich}
              onToggle={(optId) => toggle(event.id, p.kind, optId)}
            />
          </Section>
        ))}

        {polls.length === 0 && (
          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              padding: 24,
              borderRadius: 18,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
              No polls yet
            </Text>
            <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
              Run a vote on dates, the place, or the activities. Everyone going can chime in.
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => comingSoon('add_poll')}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: tokens.color.bgPrimary,
            borderWidth: 1,
            borderColor: tokens.color.accentPrimary,
            borderRadius: 999,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700' }}>+ New poll</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PollList({
  options,
  totalVoters,
  richCards,
  onToggle,
}: {
  options: PollOption[];
  totalVoters: number;
  richCards?: boolean;
  onToggle: (optionId: string) => void;
}) {
  const totalVotes = options.reduce((s, o) => s + o.votes.length, 0) || 1;
  return (
    <View style={{ gap: 8 }}>
      {options.map((opt) => {
        const pct = Math.round((opt.votes.length / totalVotes) * 100);
        const userVoted = opt.votes.includes(ME);
        return (
          <Pressable
            key={opt.id}
            onPress={() => onToggle(opt.id)}
            style={({ pressed }) => ({
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: userVoted ? tokens.color.accentPrimary : tokens.color.borderSubtle,
              padding: 14,
              opacity: pressed ? 0.85 : 1,
              gap: 8,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {richCards && opt.tint && (
                <View
                  style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: opt.tint }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: tokens.color.textPrimary }}>
                  {opt.label}
                </Text>
                {opt.subtitle && (
                  <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
                    {opt.subtitle}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{ fontSize: 13, fontWeight: '700', color: tokens.color.accentPrimary }}
                >
                  {opt.votes.length}/{totalVoters}
                </Text>
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  {opt.votes.slice(0, 3).map((mid, i) => (
                    <View key={mid} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                      <Avatar member={getAnyMember(mid)} size="sm" />
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: tokens.color.bgTinted,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: userVoted
                    ? tokens.color.accentPrimary
                    : tokens.color.accentSecondary,
                }}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
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
            color: tokens.color.accentPrimary,
            letterSpacing: 1.5,
          }}
        >
          {subtitle.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 24, fontWeight: '700', color: tokens.color.textPrimary }}>
          {title}
        </Text>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.textSecondary }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

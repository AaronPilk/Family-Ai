import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { MEMBERS, ME, type FamilyMoment, type PollOption, type PackingItem, type MomentMessage } from '../../lib/mockData';
import { useMoment, useMomentStore } from '../../lib/momentStore';
import { Avatar } from '../../components/Avatar';
import { comingSoon } from '../../lib/comingSoon';

export default function MomentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const fallbackId = id ?? 'tahoe';
  const moment = useMoment(fallbackId);
  const toggleVote = useMomentStore((s) => s.toggleVote);
  const togglePacking = useMomentStore((s) => s.togglePackingItem);

  if (!moment) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: tokens.color.textMuted }}>Moment not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Hero */}
        <View
          style={{
            height: 240,
            backgroundColor: moment.coverTint,
            justifyContent: 'flex-end',
            paddingTop: insets.top,
          }}
        >
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 64 }}>{moment.coverGlyph}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 24 }}>
          {/* Title block */}
          <View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: tokens.color.accentPrimary,
                letterSpacing: 1.5,
              }}
            >
              {moment.status.toUpperCase()} · {moment.subtitle.toUpperCase()}
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '700',
                color: tokens.color.textPrimary,
                marginTop: 4,
              }}
            >
              {moment.title}
            </Text>
            <Text style={{ fontSize: 15, color: tokens.color.textMuted, marginTop: 4 }}>
              {moment.dateRangeText} · organized by {MEMBERS[moment.organizerId].name}
            </Text>
          </View>

          {/* Who's going */}
          <Section title="Who's going">
            <Pressable
              onPress={() => comingSoon('message_everyone')}
              style={({ pressed }) => ({
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ flexDirection: 'row' }}>
                {moment.participantIds.map((mid, i) => (
                  <View key={mid} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                    <Avatar member={MEMBERS[mid]} size="md" />
                  </View>
                ))}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: tokens.color.textPrimary, fontWeight: '600' }}>
                  {moment.participantIds.length} confirmed
                </Text>
                <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
                  Tap to message everyone
                </Text>
              </View>
            </Pressable>
          </Section>

          {/* Date vote */}
          {moment.datePoll && (
            <Section title="Pick the dates">
              <PollList
                options={moment.datePoll}
                totalVoters={moment.participantIds.length}
                onToggle={(optId) => toggleVote(moment.id, 'datePoll', optId)}
              />
            </Section>
          )}

          {/* Location vote */}
          {moment.locationPoll && (
            <Section title="Pick the place">
              <PollList
                options={moment.locationPoll}
                totalVoters={moment.participantIds.length}
                richCards
                onToggle={(optId) => toggleVote(moment.id, 'locationPoll', optId)}
              />
            </Section>
          )}

          {/* Packing list */}
          {moment.packingList && (
            <Section title="Who's bringing what">
              <View
                style={{
                  backgroundColor: tokens.color.bgPrimary,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: tokens.color.borderSubtle,
                  overflow: 'hidden',
                }}
              >
                {moment.packingList.map((p, idx) => (
                  <PackingRow
                    key={p.id}
                    item={p}
                    last={idx === moment.packingList!.length - 1}
                    onToggle={() => togglePacking(moment.id, p.id)}
                  />
                ))}
              </View>
              <Pressable
                onPress={() => comingSoon('add_to_packing')}
                style={({ pressed }) => ({
                  marginTop: 10,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: tokens.color.bgTinted,
                  borderRadius: 999,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: tokens.color.accentPrimary, fontWeight: '600', fontSize: 13 }}>
                  + Add to the list
                </Text>
              </Pressable>
            </Section>
          )}

          {/* Planning chatter */}
          <Section title="Planning chatter">
            <View style={{ gap: 10 }}>
              {moment.activity.map((msg) => (
                <ActivityRow key={msg.id} msg={msg} />
              ))}
            </View>
          </Section>

          {/* After the trip placeholder */}
          <Section title="After the trip">
            <View
              style={{
                backgroundColor: tokens.color.bgTinted,
                padding: 16,
                borderRadius: 16,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14, color: tokens.color.textPrimary, lineHeight: 20, fontWeight: '600' }}>
                Everything captured during the trip will live here.
              </Text>
              <Text style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 19 }}>
                Photos, voice notes, and reactions everyone shares while in Tahoe will auto-collect into
                this Moment's timeline. After the trip, Kin can stitch it into a chapter of the family book —
                with the votes, packing list, and "who said what" all included.
              </Text>
            </View>
          </Section>
        </View>
      </ScrollView>

      {/* Floating back button — overlay, always tappable */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={({ pressed }) => ({
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.92)',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        })}
      >
        <Text style={{ fontSize: 22, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
      </Pressable>
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
                <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: opt.tint }} />
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
                <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.color.accentPrimary }}>
                  {opt.votes.length}/{totalVoters}
                </Text>
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  {opt.votes.slice(0, 3).map((mid, i) => (
                    <View key={mid} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                      <Avatar member={MEMBERS[mid]} size="sm" />
                    </View>
                  ))}
                </View>
              </View>
            </View>
            {/* Vote bar */}
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

function PackingRow({
  item,
  last,
  onToggle,
}: {
  item: PackingItem;
  last?: boolean;
  onToggle: () => void;
}) {
  const assignee = item.assigneeId ? MEMBERS[item.assigneeId] : null;
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          backgroundColor: item.checked ? tokens.color.accentPrimary : 'transparent',
          borderWidth: 2,
          borderColor: item.checked ? tokens.color.accentPrimary : tokens.color.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.checked && <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>✓</Text>}
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          color: tokens.color.textPrimary,
          textDecorationLine: item.checked ? 'line-through' : 'none',
          opacity: item.checked ? 0.6 : 1,
        }}
      >
        {item.item}
      </Text>
      {assignee && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Avatar member={assignee} size="sm" />
          <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>
            {assignee.relationship === 'You' ? 'You' : assignee.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function ActivityRow({ msg }: { msg: MomentMessage }) {
  const author = MEMBERS[msg.authorId];
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        gap: 12,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
      }}
    >
      <Avatar member={author} size="sm" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>
          {author.name} · {msg.whenAgo}
        </Text>
        <Text style={{ fontSize: 15, color: tokens.color.textPrimary, marginTop: 4, lineHeight: 21 }}>
          {msg.body}
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

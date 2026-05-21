import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  MEMBERS,
  ME,
  getAnyMember,
  daysUntil,
  rsvpCount,
  type FamilyEvent,
  type EventRsvp,
  type EventGuest,
  type PollOption,
  type PackingItem,
  type MomentMessage,
  type EventPhoto,
} from '../../lib/mockData';
import { useEvent, useEventStore, useMyRsvp } from '../../lib/eventStore';
import { Avatar } from '../../components/Avatar';
import { comingSoon } from '../../lib/comingSoon';

/**
 * Event home. Route stays at /moment/[id] to keep existing links live,
 * but this is now the full Event hub: RSVP, polls, bring list, photos,
 * planning chatter, and (post-event) the highlight reel.
 */
export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const fallbackId = id ?? 'pilks-reunion-2026';
  const event = useEvent(fallbackId);
  const myRsvp = useMyRsvp(fallbackId);
  const setMyRsvp = useEventStore((s) => s.setMyRsvp);
  const togglePollVote = useEventStore((s) => s.togglePollVote);
  const toggleBringChecked = useEventStore((s) => s.toggleBringChecked);

  if (!event) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: tokens.color.textMuted }}>Event not found.</Text>
      </View>
    );
  }

  const days = daysUntil(event.startsAt);
  const going = rsvpCount(event, 'going');
  const maybe = rsvpCount(event, 'maybe');
  const showHighlights = event.status === 'past' && (event.highlights?.length ?? 0) > 0;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Hero */}
        <View
          style={{
            height: 260,
            backgroundColor: event.coverTint,
            justifyContent: 'flex-end',
            paddingTop: insets.top,
          }}
        >
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 72 }}>{event.coverGlyph}</Text>
          </View>
          {event.branchIds.length > 1 && (
            <View
              style={{
                position: 'absolute',
                top: insets.top + 12,
                right: 16,
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: 'rgba(255,255,255,0.92)',
                borderRadius: 999,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.color.textPrimary }}>
                CROSS-BRANCH
              </Text>
            </View>
          )}
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
              {event.status.toUpperCase()} · {event.kind.toUpperCase()}
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '700',
                color: tokens.color.textPrimary,
                marginTop: 4,
              }}
            >
              {event.title}
            </Text>
            <Text style={{ fontSize: 15, color: tokens.color.textMuted, marginTop: 4 }}>
              {event.dateRangeText}
              {event.locationText ? `\n${event.locationText}` : ''}
            </Text>
            {event.status !== 'past' && days >= 0 && (
              <View
                style={{
                  marginTop: 14,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  backgroundColor: tokens.color.accentPrimary,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                  {days === 0 ? 'Starts today' : days === 1 ? 'Tomorrow' : `${days} days away`}
                </Text>
              </View>
            )}
          </View>

          {/* RSVP */}
          {event.status !== 'past' && (
            <Section title="Will you be there?">
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['going', 'maybe', 'no'] as EventRsvp[]).map((opt) => (
                  <RsvpPill
                    key={opt}
                    label={
                      opt === 'going' ? "I'm going" : opt === 'maybe' ? 'Maybe' : "Can't make it"
                    }
                    active={myRsvp === opt}
                    onPress={() => setMyRsvp(event.id, opt)}
                  />
                ))}
              </View>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: tokens.color.textMuted,
                }}
              >
                {going} going · {maybe} maybe · {event.guests.length} invited
              </Text>
            </Section>
          )}

          {/* Group chat — the spine of the reunion side. Promoted to the top. */}
          <ChatPanel event={event} />

          {/* Quick links */}
          <Section title="Get organized">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <QuickLink
                glyph="🧺"
                label="Bringing"
                subtitle={`${event.bringList.length} items`}
                onPress={() => router.push(`/moment/${event.id}/bring`)}
              />
              <QuickLink
                glyph="🗳"
                label="Activities"
                subtitle={
                  event.polls.activity ? `${event.polls.activity.length} options` : 'Add a poll'
                }
                onPress={() => router.push(`/moment/${event.id}/polls`)}
              />
              <QuickLink
                glyph="📸"
                label="Photos"
                subtitle={`${event.photos.length} shared`}
                onPress={() => router.push(`/moment/${event.id}/feed`)}
              />
              <QuickLink
                glyph="👥"
                label="Guests"
                subtitle={`${event.guests.length} invited`}
                onPress={() => router.push(`/moment/${event.id}/guests`)}
              />
            </View>
          </Section>

          {/* Guests preview */}
          <Section
            title="Who's coming"
            action={{ label: 'See all', onPress: () => router.push(`/moment/${event.id}/guests`) }}
          >
            <GuestPreview guests={event.guests} />
          </Section>

          {/* Activity poll */}
          {event.polls.activity && event.polls.activity.length > 0 && (
            <Section
              title="Vote: what do we do?"
              action={{
                label: 'All polls',
                onPress: () => router.push(`/moment/${event.id}/polls`),
              }}
            >
              <PollList
                options={event.polls.activity}
                totalVoters={going + maybe || 1}
                onToggle={(optId) => togglePollVote(event.id, 'activity', optId)}
              />
            </Section>
          )}

          {/* Date poll if present */}
          {event.polls.date && event.polls.date.length > 0 && (
            <Section title="Vote: the dates">
              <PollList
                options={event.polls.date}
                totalVoters={going + maybe || 1}
                onToggle={(optId) => togglePollVote(event.id, 'date', optId)}
              />
            </Section>
          )}

          {/* Location poll if present */}
          {event.polls.location && event.polls.location.length > 0 && (
            <Section title="Vote: the place">
              <PollList
                options={event.polls.location}
                totalVoters={going + maybe || 1}
                richCards
                onToggle={(optId) => togglePollVote(event.id, 'location', optId)}
              />
            </Section>
          )}

          {/* Bring list preview (first 5) */}
          {event.bringList.length > 0 && (
            <Section
              title="Who's bringing what"
              action={{
                label: 'Full list',
                onPress: () => router.push(`/moment/${event.id}/bring`),
              }}
            >
              <View
                style={{
                  backgroundColor: tokens.color.bgPrimary,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: tokens.color.borderSubtle,
                  overflow: 'hidden',
                }}
              >
                {event.bringList.slice(0, 5).map((p, idx) => (
                  <BringRow
                    key={p.id}
                    item={p}
                    last={idx === Math.min(4, event.bringList.length - 1)}
                    onToggle={() => toggleBringChecked(event.id, p.id)}
                  />
                ))}
              </View>
            </Section>
          )}

          {/* Photos preview */}
          {event.photos.length > 0 && (
            <Section
              title={event.status === 'past' ? 'From the trip' : 'Excitement building'}
              action={{
                label: 'All photos',
                onPress: () => router.push(`/moment/${event.id}/feed`),
              }}
            >
              <PhotoPreview photos={event.photos.slice(0, 3)} />
            </Section>
          )}

          {/* Highlights — past only */}
          {showHighlights && (
            <Section title="Highlights">
              <View style={{ gap: 10 }}>
                {event.highlights!.map((h, i) => (
                  <HighlightCard key={i} highlight={h} event={event} />
                ))}
              </View>
              <Pressable
                onPress={() => comingSoon('share_highlight_reel')}
                style={({ pressed }) => ({
                  marginTop: 8,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  backgroundColor: tokens.color.accentPrimary,
                  borderRadius: 999,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Share highlight reel</Text>
              </Pressable>
            </Section>
          )}

          {/* After the event placeholder — pre-event only */}
          {event.status !== 'past' && (
            <Section title="When it's over">
              <View
                style={{
                  backgroundColor: tokens.color.bgTinted,
                  padding: 18,
                  borderRadius: 16,
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: tokens.color.textPrimary,
                    lineHeight: 21,
                    fontWeight: '700',
                  }}
                >
                  After {event.title.toLowerCase()} ends, Kin stitches a highlight reel.
                </Text>
                <Text style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 20 }}>
                  Best photos, the funniest moments, who won which vote, the planning chatter that
                  cracked everyone up — all in one shareable reel. Every guest gets it.
                </Text>
              </View>
            </Section>
          )}
        </View>
      </ScrollView>

      {/* Floating back button */}
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

// ---- Sub-components ---------------------------------------------------------

function ChatPanel({ event }: { event: FamilyEvent }) {
  const messages = event.activity;
  const latest = messages.slice(-2);
  const totalCount = messages.length;
  const recentSenders = uniqueRecent(messages, 4);

  return (
    <Pressable
      onPress={() => router.push(`/moment/${event.id}/chat`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        overflow: 'hidden',
        opacity: pressed ? 0.9 : 1,
        shadowColor: '#1A1418',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      })}
    >
      {/* Header strip */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: tokens.color.bgTinted,
          borderBottomWidth: 1,
          borderBottomColor: tokens.color.borderSubtle,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: tokens.color.accentPrimary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 16 }}>💬</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: tokens.color.textPrimary }}>
            Group chat
          </Text>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>
            {totalCount > 0
              ? `${totalCount} messages · ${event.guests.filter((g) => g.rsvp === 'going').length} going`
              : `${event.guests.filter((g) => g.rsvp === 'going').length} going`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {recentSenders.map((mid, i) => (
            <View
              key={mid}
              style={{
                marginLeft: i === 0 ? 0 : -6,
                borderWidth: 1.5,
                borderColor: tokens.color.bgTinted,
                borderRadius: 999,
              }}
            >
              <Avatar member={getAnyMember(mid)} size="sm" />
            </View>
          ))}
        </View>
      </View>

      {/* Latest messages */}
      <View style={{ padding: 14, gap: 10 }}>
        {latest.length === 0 ? (
          <Text
            style={{
              fontSize: 14,
              color: tokens.color.textSecondary,
              lineHeight: 20,
              paddingVertical: 6,
            }}
          >
            No messages yet. Send the first one — logistics, jokes, "who wants coffee from the gas
            station."
          </Text>
        ) : (
          latest.map((msg) => <ActivityRow key={msg.id} msg={msg} />)
        )}
        <View
          style={{
            alignSelf: 'flex-end',
            paddingHorizontal: 14,
            paddingVertical: 9,
            backgroundColor: tokens.color.accentPrimary,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>
            {totalCount > 0 ? 'Open chat' : 'Start the chat'}
          </Text>
          <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

function uniqueRecent(
  msgs: FamilyEvent['activity'],
  limit: number,
): FamilyEvent['activity'][number]['authorId'][] {
  type A = FamilyEvent['activity'][number]['authorId'];
  const seen = new Set<A>();
  const out: A[] = [];
  for (let i = msgs.length - 1; i >= 0 && out.length < limit; i--) {
    const a = msgs[i]!.authorId;
    if (!seen.has(a)) {
      seen.add(a);
      out.push(a);
    }
  }
  return out;
}

function RsvpPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: active ? tokens.color.accentPrimary : tokens.color.bgPrimary,
        borderWidth: 1.5,
        borderColor: active ? tokens.color.accentPrimary : tokens.color.borderSubtle,
        opacity: pressed ? 0.8 : 1,
        alignItems: 'center',
      })}
    >
      <Text
        style={{
          color: active ? 'white' : tokens.color.textPrimary,
          fontWeight: '700',
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function QuickLink({
  glyph,
  label,
  subtitle,
  onPress,
}: {
  glyph: string;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexBasis: '48%',
        flexGrow: 1,
        padding: 14,
        backgroundColor: tokens.color.bgPrimary,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        borderRadius: 16,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 26 }}>{glyph}</Text>
      <Text
        style={{ marginTop: 6, fontSize: 15, fontWeight: '700', color: tokens.color.textPrimary }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>{subtitle}</Text>
    </Pressable>
  );
}

function GuestPreview({ guests }: { guests: EventGuest[] }) {
  const going = guests.filter((g) => g.rsvp === 'going');
  const others = guests.filter((g) => g.rsvp !== 'going');
  const visible = [...going, ...others].slice(0, 8);
  const more = guests.length - visible.length;

  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {visible.map((g) => {
          const m = getAnyMember(g.memberId);
          const dimmed = g.rsvp === 'no' || g.rsvp === 'invited';
          return (
            <View
              key={g.memberId}
              style={{ alignItems: 'center', width: 60, opacity: dimmed ? 0.45 : 1 }}
            >
              <Avatar member={m} size="md" />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  marginTop: 6,
                  color: tokens.color.textPrimary,
                }}
                numberOfLines={1}
              >
                {m.name}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  marginTop: 1,
                  color:
                    g.rsvp === 'going'
                      ? tokens.color.success
                      : g.rsvp === 'maybe'
                        ? tokens.color.warning
                        : tokens.color.textMuted,
                }}
              >
                {g.rsvp === 'going'
                  ? 'Going'
                  : g.rsvp === 'maybe'
                    ? 'Maybe'
                    : g.rsvp === 'no'
                      ? "Can't"
                      : 'Invited'}
              </Text>
            </View>
          );
        })}
        {more > 0 && (
          <View
            style={{
              width: 60,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: tokens.color.bgTinted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: tokens.color.accentPrimary }}>+{more}</Text>
            </View>
            <Text style={{ fontSize: 11, color: tokens.color.textMuted, marginTop: 6 }}>more</Text>
          </View>
        )}
      </View>
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

function BringRow({
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
      {!assignee && (
        <Text style={{ fontSize: 12, color: tokens.color.accentPrimary, fontWeight: '600' }}>
          Claim
        </Text>
      )}
    </Pressable>
  );
}

function PhotoPreview({ photos }: { photos: EventPhoto[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {photos.map((p) => (
        <View
          key={p.id}
          style={{
            flex: 1,
            aspectRatio: 1,
            borderRadius: 12,
            backgroundColor: p.tint,
            padding: 10,
            justifyContent: 'flex-end',
          }}
        >
          {p.mediaKind === 'video' && (
            <View
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                paddingHorizontal: 6,
                paddingVertical: 3,
                backgroundColor: 'rgba(0,0,0,0.45)',
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 10, color: 'white', fontWeight: '700' }}>VIDEO</Text>
            </View>
          )}
          {p.caption && (
            <Text
              numberOfLines={2}
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.95)',
                fontWeight: '600',
                textShadowColor: 'rgba(0,0,0,0.4)',
                textShadowRadius: 4,
              }}
            >
              {p.caption}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function HighlightCard({
  highlight,
  event,
}: {
  highlight: NonNullable<FamilyEvent['highlights']>[number];
  event: FamilyEvent;
}) {
  if (highlight.kind === 'photo' && highlight.photoId) {
    const photo = event.photos.find((p) => p.id === highlight.photoId);
    return (
      <View
        style={{
          backgroundColor: photo?.tint ?? tokens.color.bgTinted,
          borderRadius: 14,
          padding: 16,
          minHeight: 110,
          justifyContent: 'flex-end',
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: 'rgba(255,255,255,0.95)',
            textShadowColor: 'rgba(0,0,0,0.4)',
            textShadowRadius: 4,
          }}
        >
          {highlight.body}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        borderRadius: 14,
        padding: 14,
        gap: 6,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: tokens.color.accentPrimary,
          letterSpacing: 1.2,
        }}
      >
        {highlight.kind.toUpperCase().replace('_', ' ')}
      </Text>
      <Text style={{ fontSize: 15, color: tokens.color.textPrimary, lineHeight: 22 }}>
        {highlight.body}
      </Text>
      {highlight.authorId && (
        <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 4 }}>
          — {getAnyMember(highlight.authorId).name}
        </Text>
      )}
    </View>
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
        <Text
          style={{ fontSize: 15, color: tokens.color.textPrimary, marginTop: 4, lineHeight: 21 }}
        >
          {msg.body}
        </Text>
      </View>
    </View>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.textSecondary }}>
          {title}
        </Text>
        {action && (
          <Pressable onPress={action.onPress} hitSlop={8}>
            <Text style={{ fontSize: 13, color: tokens.color.accentPrimary, fontWeight: '600' }}>
              {action.label}
            </Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

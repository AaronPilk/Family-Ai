import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  FEED,
  INBOX,
  TODAY_PROMPTS,
  SUGGESTED_QUESTIONS,
  MEMBERS,
  MEMORIES_WITH,
  PHOTO_BOOKS,
  daysUntil,
  rsvpCount,
  type FeedItem,
  type FamilyEvent,
  type MemberId,
} from '../../lib/mockData';
import { useAllEvents, useHydrateEventsFromSupabase } from '../../lib/eventStore';
import {
  useCurrentBranch,
  useScopedBranchIds,
  useSelection,
  useUserRole,
} from '../../lib/branchStore';
import { Avatar } from '../../components/Avatar';
import { BranchSwitcher } from '../../components/BranchSwitcher';
import { comingSoon } from '../../lib/comingSoon';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  useHydrateEventsFromSupabase();
  const branch = useCurrentBranch();
  const sel = useSelection();
  const scopedIds = useScopedBranchIds();
  // For the daily prompt, pick the first branch in scope. Empty until the
  // prompt engine is wired — Home falls back to a friendly empty state below.
  const today = TODAY_PROMPTS[scopedIds[0] ?? 'pilks'];
  const inbox = INBOX.filter((q) => scopedIds.includes(q.branchId));
  const feed = FEED.filter((f) => scopedIds.includes(f.branchId));
  const userRole = useUserRole();
  // For younger users (children/grandchildren), pick the first suggested
  // question in scope. Empty until the prompt engine is wired.
  const askSuggestion = SUGGESTED_QUESTIONS.find((q) => scopedIds.includes(q.branchId));
  const upcomingEvents = useAllEvents()
    .filter((e) => e.status !== 'past')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const nextEvent = upcomingEvents[0];
  const nextEventDays = nextEvent ? daysUntil(nextEvent.startsAt) : Infinity;
  const hoistNextEvent = nextEvent && nextEventDays <= 60;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 120,
        }}
      >
        {/* Top branding + branch switcher */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <BranchSwitcher />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginTop: 10,
            }}
          >
            <View>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: tokens.color.textPrimary,
                }}
              >
                Today
              </Text>
              <Text style={{ fontSize: 14, color: tokens.color.textMuted, marginTop: 2 }}>
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton glyph="🔍" onPress={() => router.push('/search')} />
              <IconButton glyph="🔔" onPress={() => router.push('/notifications')} />
            </View>
          </View>
        </View>

        {/* UPCOMING EVENT hero — only when something is within 60 days */}
        {hoistNextEvent && (
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <UpcomingEventHero event={nextEvent!} days={nextEventDays} />
          </View>
        )}

        {/* TODAY hero — different shape for elders (answer) vs younger (ask) */}
        <View style={{ paddingHorizontal: 20 }}>
          {userRole === 'elder' && today ? (
            <View
              style={{
                backgroundColor: tokens.color.accentPrimary,
                borderRadius: 24,
                padding: 22,
                shadowColor: tokens.color.accentPrimary,
                shadowOpacity: 0.25,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
              }}
            >
              <Text
                style={{
                  color: '#FFD8E0',
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1.5,
                }}
              >
                YOUR PROMPT TODAY
              </Text>
              <Text
                style={{
                  color: 'white',
                  fontSize: 22,
                  fontWeight: '700',
                  lineHeight: 30,
                  marginTop: 10,
                }}
              >
                {today.prompt}
              </Text>
              <View
                style={{
                  marginTop: 18,
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <PromptAction
                  label="🎤  Voice"
                  primary
                  onPress={() => comingSoon('record_voice')}
                />
                <PromptAction label="✍️  Type" onPress={() => comingSoon('today_prompt')} />
                <PromptAction label="↷ Skip" onPress={() => comingSoon('skip_prompt')} />
              </View>
              <Text style={{ marginTop: 16, color: '#FFD8E0', fontSize: 13 }}>
                When you answer, it lives in three places: your timeline, the family book, and the
                relationship story of whoever you're talking to.
              </Text>
            </View>
          ) : (
            <AskTodayHero suggestion={askSuggestion} />
          )}
        </View>

        {/* EVENTS — upcoming reunions / vacations */}
        {upcomingEvents.length > 0 && (
          <Section
            title="Coming up"
            action={{ label: 'See all', onPress: () => router.push('/events') }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingRight: 8 }}
            >
              {upcomingEvents.map((e) => (
                <EventMiniCard key={e.id} event={e} />
              ))}
            </ScrollView>
            <Pressable
              onPress={() => router.push('/new/event')}
              style={({ pressed }) => ({
                marginTop: 4,
                paddingHorizontal: 16,
                paddingVertical: 10,
                alignSelf: 'flex-start',
                backgroundColor: tokens.color.bgTinted,
                borderRadius: 999,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: tokens.color.accentPrimary, fontWeight: '600', fontSize: 13 }}>
                + Start a reunion or vacation
              </Text>
            </Pressable>
          </Section>
        )}

        {/* INBOX */}
        {inbox.length > 0 && (
          <Section
            title={`People asked you ${inbox.length} ${inbox.length === 1 ? 'question' : 'questions'}`}
          >
            <View style={{ gap: 10 }}>
              {inbox.map((q) => {
                const from = MEMBERS[q.fromId];
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => router.push(`/answer/${q.id}`)}
                    style={({ pressed }) => ({
                      backgroundColor: tokens.color.bgPrimary,
                      padding: 14,
                      borderRadius: 16,
                      flexDirection: 'row',
                      gap: 12,
                      borderWidth: 1,
                      borderColor: tokens.color.borderSubtle,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Avatar member={from} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 13, color: tokens.color.textMuted, marginBottom: 4 }}
                      >
                        {from.relationship} · {q.whenAgo}
                      </Text>
                      <Text
                        style={{
                          fontSize: 15,
                          color: tokens.color.textPrimary,
                          lineHeight: 21,
                        }}
                      >
                        {q.body}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: tokens.color.accentPrimary,
                          fontWeight: '700',
                          marginTop: 8,
                        }}
                      >
                        Answer →
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        )}

        {/* Photo Books — coming soon. Kept visible so the vision is communicated,
            but visually toned down and explicitly labeled so nobody (Mom) expects
            it to work in July. Camera wiring + OCR + AI tagging is real work. */}
        <Section title="Bring the old albums in">
          <Pressable
            onPress={() => comingSoon('photo_book')}
            style={({ pressed }) => ({
              backgroundColor: '#F2EFEA',
              padding: 18,
              borderRadius: 18,
              opacity: pressed ? 0.6 : 0.75,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: '#D8C8B0',
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text
                style={{
                  color: '#8C6A3F',
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1.2,
                }}
              >
                PHOTO BOOK CAPTURE
              </Text>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#D8C8B0',
                  borderRadius: 999,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#8C6A3F' }}>
                  COMING SOON
                </Text>
              </View>
            </View>
            <Text
              style={{
                color: tokens.color.textPrimary,
                fontSize: 17,
                fontWeight: '700',
                marginTop: 8,
              }}
            >
              Digitize an album one page at a time
            </Text>
            <Text
              style={{
                color: tokens.color.textSecondary,
                fontSize: 14,
                marginTop: 4,
                lineHeight: 20,
              }}
            >
              Point your phone at each page. FamLink will extract every photo, date them, and ask
              who's in them — so your binder lives forever. (Tap for details — we'll let you know
              when it's ready.)
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              {PHOTO_BOOKS.map((b) => (
                <View
                  key={b.id}
                  style={{
                    flex: 1,
                    padding: 10,
                    backgroundColor: 'white',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E5DCD2',
                    opacity: 0.8,
                  }}
                >
                  <View
                    style={{
                      height: 60,
                      borderRadius: 8,
                      backgroundColor: b.coverTint,
                      marginBottom: 8,
                      opacity: 0.85,
                    }}
                  />
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 13, fontWeight: '700', color: tokens.color.textPrimary }}
                  >
                    {b.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: tokens.color.textMuted,
                      marginTop: 2,
                    }}
                  >
                    Sample · {b.pageCount} pages
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Section>

        {/* Recent activity strip — hidden until the timeline is wired to real
            data. Empty until then so we don't render an awkward zero-state. */}
        {feed.length > 0 && (
          <Section title="Recent in this branch">
            <View style={{ gap: 12 }}>
              {feed.slice(0, 4).map((item) => (
                <RecentRow key={item.id} item={item} />
              ))}
            </View>
            <Pressable
              onPress={() => router.push('/feed')}
              style={({ pressed }) => ({
                marginTop: 12,
                padding: 14,
                alignItems: 'center',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Text style={{ color: tokens.color.accentPrimary, fontWeight: '600' }}>
                See the whole feed →
              </Text>
            </Pressable>
          </Section>
        )}
      </ScrollView>
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
    <View style={{ paddingHorizontal: 20, marginTop: 28, gap: 12 }}>
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

function UpcomingEventHero({ event, days }: { event: FamilyEvent; days: number }) {
  const going = rsvpCount(event, 'going');
  return (
    <Pressable
      onPress={() => router.push(`/moment/${event.id}`)}
      style={({ pressed }) => ({
        backgroundColor: event.coverTint,
        borderRadius: 22,
        overflow: 'hidden',
        opacity: pressed ? 0.9 : 1,
        shadowColor: '#1A1418',
        shadowOpacity: 0.1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      })}
    >
      <View style={{ padding: 18, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: 'rgba(0,0,0,0.6)',
              letterSpacing: 1.5,
            }}
          >
            {event.kind.toUpperCase()}
            {event.branchIds.length > 1 ? ' · CROSS-BRANCH' : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <Text style={{ fontSize: 48 }}>{event.coverGlyph}</Text>
          <View style={{ flex: 1, paddingTop: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: tokens.color.textPrimary }}>
              {event.title}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: 'rgba(0,0,0,0.65)',
                marginTop: 2,
              }}
            >
              {event.dateRangeText}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: 'rgba(255,255,255,0.85)',
              borderRadius: 999,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.color.textPrimary }}>
              {days === 0 ? 'STARTS TODAY' : days === 1 ? 'TOMORROW' : `${days} DAYS AWAY`}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: 'rgba(255,255,255,0.85)',
              borderRadius: 999,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.color.textPrimary }}>
              {going} GOING
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function EventMiniCard({ event }: { event: FamilyEvent }) {
  const days = daysUntil(event.startsAt);
  return (
    <Pressable
      onPress={() => router.push(`/moment/${event.id}`)}
      style={({ pressed }) => ({
        width: 220,
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          height: 90,
          backgroundColor: event.coverTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 36 }}>{event.coverGlyph}</Text>
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: tokens.color.accentPrimary,
            letterSpacing: 1.2,
          }}
        >
          {event.kind.toUpperCase()}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: '700', color: tokens.color.textPrimary }}
        >
          {event.title}
        </Text>
        <Text style={{ fontSize: 11, color: tokens.color.textMuted }}>
          {days >= 0 && days <= 60
            ? days === 0
              ? 'Today'
              : days === 1
                ? 'Tomorrow'
                : `${days} days away`
            : event.dateRangeText}
        </Text>
      </View>
    </Pressable>
  );
}

function RecentRow({ item }: { item: FeedItem }) {
  const author = MEMBERS[item.authorId];
  return (
    <Pressable
      onPress={() => router.push(`/member/${item.authorId}`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        padding: 14,
        borderRadius: 14,
        flexDirection: 'row',
        gap: 12,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Avatar member={author} size="sm" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.color.textPrimary }}>
            {author.name}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>
            · {author.relationship} · {item.whenAgo}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={{ fontSize: 14, color: tokens.color.textPrimary, marginTop: 4, lineHeight: 20 }}
        >
          {item.body}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {item.appearsIn.map((t) => (
            <View
              key={t}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                backgroundColor: tokens.color.bgTinted,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 11, color: tokens.color.accentPrimary, fontWeight: '600' }}>
                {t}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

function PromptAction({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: primary ? 'white' : 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: primary ? tokens.color.accentPrimary : 'white',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AskTodayHero({
  suggestion,
}: {
  suggestion: (typeof SUGGESTED_QUESTIONS)[number] | undefined;
}) {
  if (!suggestion) {
    return (
      <View
        style={{
          backgroundColor: tokens.color.bgTinted,
          borderRadius: 24,
          padding: 22,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
          Nothing to ask today
        </Text>
        <Text
          style={{ fontSize: 13, color: tokens.color.textSecondary, marginTop: 6, lineHeight: 19 }}
        >
          Once your family is in, you'll see one good question to ask them every day.
        </Text>
      </View>
    );
  }
  const target = MEMBERS[suggestion.ask as MemberId];
  return (
    <View
      style={{
        backgroundColor: tokens.color.accentPrimary,
        borderRadius: 24,
        padding: 22,
        shadowColor: tokens.color.accentPrimary,
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      <Text
        style={{
          color: '#FFD8E0',
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 1.5,
        }}
      >
        ASK SOMEONE TODAY
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <Avatar member={target} size="md" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>
            {target.name} · {target.relationship}
          </Text>
          <Text style={{ color: '#FFD8E0', fontSize: 12, marginTop: 2 }}>
            {MEMORIES_WITH[suggestion.ask as MemberId] ?? 0} memories together
          </Text>
        </View>
      </View>
      <Text
        style={{
          color: 'white',
          fontSize: 22,
          fontWeight: '700',
          lineHeight: 30,
          marginTop: 14,
        }}
      >
        {suggestion.text}
      </Text>
      <View
        style={{
          marginTop: 18,
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <PromptAction label="✉  Send to them" primary onPress={() => comingSoon('send_question')} />
        <PromptAction label="↺ Another" onPress={() => comingSoon('today_prompt')} />
      </View>
      <Text style={{ marginTop: 16, color: '#FFD8E0', fontSize: 13 }}>
        They get a soft push notification. When they answer, it lives in your timeline, theirs, and
        the family book.
      </Text>
    </View>
  );
}

function IconButton({ glyph, onPress }: { glyph: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
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
      <Text style={{ fontSize: 16 }}>{glyph}</Text>
    </Pressable>
  );
}

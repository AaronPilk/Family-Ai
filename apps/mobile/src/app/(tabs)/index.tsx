import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View, Text, Pressable, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  getMySubscription,
  paywallActive,
  isPaywallEnabled,
  type MySubscription,
} from '../../lib/billing';
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
import { DemoModeBanner } from '../../components/DemoModeBanner';
import { comingSoon } from '../../lib/comingSoon';
import { useHasFamily } from '../../lib/useHasFamily';
import { showDemoAlert } from '../../lib/demoGuard';
import {
  DEMO_TODAY_PROMPT,
  DEMO_INBOX,
  DEMO_SUGGESTED_QUESTIONS,
  DEMO_PEOPLE,
  eventsFromDemo,
} from '../../lib/demoData';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  useHydrateEventsFromSupabase();
  const branch = useCurrentBranch();
  const sel = useSelection();
  const scopedIds = useScopedBranchIds();
  const userRole = useUserRole();
  const { hasFamily, loading: hasFamilyLoading, justConnected, clearCelebration } = useHasFamily();

  // Subscription / paywall state. Best-effort fetch — never blocks render.
  // `paywall_active` is computed locally and used today only to surface a
  // "Subscribe" nudge banner when the EXPO_PUBLIC_PAYWALL_ENABLED flag is on
  // and the user isn't yet entitled. Actual feature gating is a follow-up.
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!isPaywallEnabled()) return;
    (async () => {
      try {
        const s = await getMySubscription();
        if (!cancelled) setSubscription(s);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const paywall_active = paywallActive(subscription);

  // Real-data path
  const realToday = TODAY_PROMPTS[scopedIds[0] ?? 'pilks'];
  const realInbox = INBOX.filter((q) => scopedIds.includes(q.branchId));
  const realFeed = FEED.filter((f) => scopedIds.includes(f.branchId));
  const realAskSuggestion = SUGGESTED_QUESTIONS.find((q) => scopedIds.includes(q.branchId));
  const realEvents = useAllEvents();

  // Demo or real, depending on hasFamily
  const today = hasFamily
    ? realToday
    : ({
        id: DEMO_TODAY_PROMPT.id,
        prompt: DEMO_TODAY_PROMPT.prompt,
        source: 'curated' as const,
      } as { id: string; prompt: string; source: 'ai' | 'curated' | 'family'; fromName?: string });
  const inbox = hasFamily
    ? realInbox
    : DEMO_INBOX.map((q) => ({
        id: q.id,
        branchId: 'pilks' as const,
        fromId: 'me' as MemberId, // tagged so MEMBERS[fromId] returns a safe stub; we render name below
        body: q.body,
        whenAgo: q.whenAgo,
        // Demo passthrough fields for rendering
        _demoFromName: q.fromId === DEMO_PEOPLE.mom.id
          ? DEMO_PEOPLE.mom.name
          : q.fromId === DEMO_PEOPLE.grandma.id
            ? DEMO_PEOPLE.grandma.name
            : 'Family member',
        _demoFromRelationship:
          q.fromId === DEMO_PEOPLE.mom.id
            ? 'Mom'
            : q.fromId === DEMO_PEOPLE.grandma.id
              ? 'Grandma'
              : 'Family',
        _demoFromColor:
          q.fromId === DEMO_PEOPLE.mom.id
            ? DEMO_PEOPLE.mom.color
            : q.fromId === DEMO_PEOPLE.grandma.id
              ? DEMO_PEOPLE.grandma.color
              : tokens.color.accentPrimary,
        _demoFromInitials:
          q.fromId === DEMO_PEOPLE.mom.id
            ? DEMO_PEOPLE.mom.initials
            : q.fromId === DEMO_PEOPLE.grandma.id
              ? DEMO_PEOPLE.grandma.initials
              : 'F',
      }));
  const feed = hasFamily ? realFeed : [];
  const askSuggestion = hasFamily
    ? realAskSuggestion
    : ({
        branchId: 'pilks' as const,
        ask: 'me' as MemberId,
        text: DEMO_SUGGESTED_QUESTIONS[0]!.text,
        _demoTargetName: DEMO_PEOPLE.grandma.name,
        _demoTargetRel: DEMO_PEOPLE.grandma.relationship,
        _demoTargetColor: DEMO_PEOPLE.grandma.color,
        _demoTargetInitials: DEMO_PEOPLE.grandma.initials,
      } as any);
  const upcomingEvents = (hasFamily ? realEvents : eventsFromDemo())
    .filter((e) => e.status !== 'past')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const nextEvent = upcomingEvents[0];
  const nextEventDays = nextEvent ? daysUntil(nextEvent.startsAt) : Infinity;
  const hoistNextEvent = nextEvent && nextEventDays <= 60;

  // One-time celebration toast when demo→real flip happens.
  useEffect(() => {
    if (!justConnected) return;
    clearCelebration();
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-console
      console.log("[FamLink] You're connected with your family now.");
      return;
    }
    Alert.alert("You're connected!", "👋 You're now linked up with your family on FamLink.", [
      { text: 'Sweet', style: 'default' },
    ]);
  }, [justConnected, clearCelebration]);

  if (hasFamilyLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.color.accentPrimary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      {!hasFamily && (
        <View style={{ paddingTop: insets.top }}>
          <DemoModeBanner />
        </View>
      )}
      <ScrollView
        contentContainerStyle={{
          paddingTop: hasFamily ? insets.top + 8 : 8,
          paddingBottom: insets.bottom + 120,
        }}
      >
        {/* Paywall nudge — only shown when EXPO_PUBLIC_PAYWALL_ENABLED is on
            AND the user isn't entitled. No-op during Friends & Family launch. */}
        {paywall_active && (
          <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
            <Pressable
              onPress={() => router.push('/billing')}
              style={({ pressed }) => ({
                backgroundColor: tokens.color.bgTinted,
                borderWidth: 1,
                borderColor: tokens.color.accentSecondary,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 18 }}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: tokens.color.textPrimary,
                  }}
                >
                  Subscribe to keep using FamLink
                </Text>
                <Text style={{ fontSize: 12, color: tokens.color.textSecondary, marginTop: 2 }}>
                  $19.99/year — or claim free Friends & Family access.
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: tokens.color.accentPrimary }}>›</Text>
            </Pressable>
          </View>
        )}

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
                <PromptAction
                  label="✍️  Answer"
                  onPress={() => router.push('/answer/today')}
                />
                <PromptAction label="More →" onPress={() => router.push('/answer/today')} />
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
                const demoQ = q as typeof q & {
                  _demoFromName?: string;
                  _demoFromRelationship?: string;
                  _demoFromColor?: string;
                  _demoFromInitials?: string;
                };
                const from = MEMBERS[q.fromId];
                const isDemo = !!demoQ._demoFromName;
                const displayMember = isDemo
                  ? ({
                      id: q.fromId,
                      name: demoQ._demoFromName!,
                      relationship: demoQ._demoFromRelationship!,
                      initials: demoQ._demoFromInitials!,
                      color: demoQ._demoFromColor!,
                    } as typeof from)
                  : from;
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => !isDemo && router.push(`/answer/${q.id}`)}
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
                    <Avatar member={displayMember} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 13, color: tokens.color.textMuted, marginBottom: 4 }}
                      >
                        {displayMember.relationship} · {q.whenAgo}
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
  const isDemo = event.id.startsWith('demo_');
  return (
    <Pressable
      onPress={() => {
        if (isDemo) {
          showDemoAlert('event');
          return;
        }
        router.push(`/moment/${event.id}`);
      }}
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
  const isDemo = event.id.startsWith('demo_');
  return (
    <Pressable
      onPress={() => {
        if (isDemo) {
          showDemoAlert('event');
          return;
        }
        router.push(`/moment/${event.id}`);
      }}
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
  const isDemo = String(item.authorId).startsWith('demo_');
  return (
    <Pressable
      onPress={() => {
        if (isDemo) {
          showDemoAlert('member');
          return;
        }
        router.push(`/member/${item.authorId}`);
      }}
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
  suggestion:
    | ((typeof SUGGESTED_QUESTIONS)[number] & {
        _demoTargetName?: string;
        _demoTargetRel?: string;
        _demoTargetColor?: string;
        _demoTargetInitials?: string;
      })
    | undefined;
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
  const realTarget = MEMBERS[suggestion.ask as MemberId];
  const isDemo = !!suggestion._demoTargetName;
  const target = isDemo
    ? ({
        id: 'me' as MemberId,
        name: suggestion._demoTargetName!,
        relationship: suggestion._demoTargetRel!,
        initials: suggestion._demoTargetInitials!,
        color: suggestion._demoTargetColor!,
      } as typeof realTarget)
    : realTarget;
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
            {isDemo ? 'A few memories together' : `${MEMORIES_WITH[suggestion.ask as MemberId] ?? 0} memories together`}
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

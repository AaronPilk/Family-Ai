import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { daysUntil, rsvpCount, type FamilyEvent } from '../../lib/mockData';
import { useAllEvents, useHydrateEventsFromSupabase } from '../../lib/eventStore';
import { useHasFamily } from '../../lib/useHasFamily';
import { eventsFromDemo } from '../../lib/demoData';
import { DemoModeBanner } from '../../components/DemoModeBanner';

/**
 * Events tab — the second-mode home. Reunions, vacations, holidays.
 * Group chat lives inside each event. This tab is the spine for everything
 * time-boxed and social.
 */
export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  useHydrateEventsFromSupabase();
  const realEvents = useAllEvents();
  const { hasFamily, loading } = useHasFamily();
  const events = hasFamily ? realEvents : eventsFromDemo();

  const upcoming = events
    .filter((e) => e.status !== 'past')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = events
    .filter((e) => e.status === 'past')
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  if (loading) {
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
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 24,
        }}
      >
        {/* Header — tab style, no back button */}
        <View>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: tokens.color.accentPrimary,
              letterSpacing: 1.5,
            }}
          >
            EVENTS & REUNIONS
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 28, fontWeight: '700', color: tokens.color.textPrimary }}>
              Get together
            </Text>
            <Pressable
              onPress={() => router.push('/new/event')}
              style={({ pressed }) => ({
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: tokens.color.accentPrimary,
                borderRadius: 999,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>+ New</Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 14, color: tokens.color.textMuted, marginTop: 4 }}>
            Reunions, vacations, holidays. Chat lives inside each one.
          </Text>
        </View>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <Section title="Upcoming">
            {upcoming.map((e, idx) => (
              <EventCard key={e.id} event={e} hero={idx === 0} />
            ))}
          </Section>
        )}

        {/* Past */}
        {past.length > 0 && (
          <Section title="Past">
            {past.map((e) => (
              <EventCard key={e.id} event={e} compact />
            ))}
          </Section>
        )}

        {/* Onboarding hint — disappears the moment the user has any event. This
            is static UI, not seeded data, so it never confuses anyone with a
            fake roster of people. */}
        {events.length === 0 && (
          <View
            style={{
              backgroundColor: tokens.color.accentPrimary,
              padding: 22,
              borderRadius: 22,
              gap: 8,
              shadowColor: tokens.color.accentPrimary,
              shadowOpacity: 0.18,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: '#FFD8E0',
                letterSpacing: 1.5,
              }}
            >
              WELCOME TO FAMLINK
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: 'white', lineHeight: 27 }}>
              Start with a reunion, vacation, or holiday gathering.
            </Text>
            <Text style={{ fontSize: 14, color: '#FFD8E0', lineHeight: 20 }}>
              Invite your family by email — they'll see the chat, the dates, the bring-list, and
              the photos as everyone fills them in.
            </Text>
            <Pressable
              onPress={() => router.push('/new/event')}
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                marginTop: 8,
                paddingHorizontal: 18,
                paddingVertical: 11,
                backgroundColor: 'white',
                borderRadius: 999,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 14 }}>
                Create your first event →
              </Text>
            </Pressable>
          </View>
        )}

        {/* Empty state */}
        {events.length === 0 && (
          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              padding: 24,
              borderRadius: 18,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
              No events yet
            </Text>
            <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
              Reunions, vacations, holidays — FamLink keeps the group chat, the invites, the
              bring-list, and the photos in one place. After the event, it stitches a highlight
              reel from everything everyone posted.
            </Text>
            <Pressable
              onPress={() => router.push('/new/event')}
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
              <Text style={{ color: 'white', fontWeight: '700' }}>+ Start an event</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---- EventCard --------------------------------------------------------------

function EventCard({
  event,
  hero,
  compact,
}: {
  event: FamilyEvent;
  hero?: boolean;
  compact?: boolean;
}) {
  const going = rsvpCount(event, 'going');
  const days = daysUntil(event.startsAt);
  const isHappening = event.status === 'happening' || (days <= 0 && days >= -7);

  return (
    <Pressable
      onPress={() => router.push(`/moment/${event.id}`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* Cover */}
      <View
        style={{
          height: hero ? 150 : compact ? 80 : 110,
          backgroundColor: event.coverTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: hero ? 56 : compact ? 32 : 40 }}>{event.coverGlyph}</Text>
        {event.branchIds.length > 1 && (
          <View
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: 'rgba(255,255,255,0.92)',
              borderRadius: 999,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: tokens.color.textPrimary }}>
              CROSS-BRANCH
            </Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={{ padding: hero ? 18 : 14, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: tokens.color.accentPrimary,
              letterSpacing: 1.2,
            }}
          >
            {event.kind.toUpperCase()}
          </Text>
          <Text style={{ fontSize: 11, color: tokens.color.textMuted }}>·</Text>
          <Text style={{ fontSize: 11, color: tokens.color.textMuted, fontWeight: '600' }}>
            {event.status.toUpperCase()}
          </Text>
        </View>
        <Text
          style={{
            fontSize: hero ? 22 : 17,
            fontWeight: '700',
            color: tokens.color.textPrimary,
          }}
        >
          {event.title}
        </Text>
        <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>
          {event.dateRangeText}
          {event.locationText ? `  ·  ${event.locationText}` : ''}
        </Text>

        {!compact && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <CountChip
              label={`${going} going`}
              tint={tokens.color.accentPrimary + '22'}
              textColor={tokens.color.accentPrimary}
            />
            {event.activity.length > 0 && (
              <CountChip
                label={`💬 ${event.activity.length}`}
                tint={tokens.color.bgTinted}
                textColor={tokens.color.textSecondary}
              />
            )}
            {event.status !== 'past' && days >= 0 && (
              <CountChip
                label={days === 0 ? 'Starts today' : days === 1 ? 'Tomorrow' : `${days} days away`}
                tint={tokens.color.bgTinted}
                textColor={tokens.color.textSecondary}
              />
            )}
            {isHappening && (
              <CountChip
                label="LIVE"
                tint={tokens.color.success + '22'}
                textColor={tokens.color.success}
              />
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function CountChip({ label, tint, textColor }: { label: string; tint: string; textColor: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: tint,
        borderRadius: 999,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: textColor }}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: tokens.color.textSecondary,
          letterSpacing: 0.5,
          paddingHorizontal: 4,
        }}
      >
        {title.toUpperCase()}
      </Text>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

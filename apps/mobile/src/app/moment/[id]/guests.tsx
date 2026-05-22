import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../theme/tokens';
import { getAnyMember, type EventGuest, type EventRsvp } from '../../../lib/mockData';
import { useEvent } from '../../../lib/eventStore';
import { Avatar } from '../../../components/Avatar';

export default function EventGuests() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const event = useEvent(id ?? '');

  if (!event) return null;

  const buckets: Record<EventRsvp, EventGuest[]> = {
    going: event.guests.filter((g) => g.rsvp === 'going'),
    maybe: event.guests.filter((g) => g.rsvp === 'maybe'),
    invited: event.guests.filter((g) => g.rsvp === 'invited'),
    no: event.guests.filter((g) => g.rsvp === 'no'),
  };

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
        <Header title="Guests" subtitle={event.title} />

        {/* Invite CTA — routes to /moment/[id]/invite-guests where the user
            picks connected family members in bulk. The event_guests insert
            trigger pushes each invitee a notification. SMS/email entry is
            queued as a follow-up entry point on the same screen. */}
        <Pressable
          onPress={() => router.push(`/moment/${id}/invite-guests`)}
          style={({ pressed }) => ({
            backgroundColor: tokens.color.accentPrimary,
            borderRadius: 16,
            padding: 16,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>+ Invite family</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 }}>
            Pick from your family tree. They'll get a push notification. To invite people
            outside FamLink, use Share link on the event page.
          </Text>
        </Pressable>

        {buckets.going.length > 0 && (
          <Bucket label="Going" tint={tokens.color.success} guests={buckets.going} />
        )}
        {buckets.maybe.length > 0 && (
          <Bucket label="Maybe" tint={tokens.color.warning} guests={buckets.maybe} />
        )}
        {buckets.invited.length > 0 && (
          <Bucket
            label="Invited — haven't responded"
            tint={tokens.color.textMuted}
            guests={buckets.invited}
          />
        )}
        {buckets.no.length > 0 && (
          <Bucket label="Can't make it" tint={tokens.color.danger} guests={buckets.no} />
        )}
      </ScrollView>
    </View>
  );
}

function Bucket({ label, tint, guests }: { label: string; tint: string; guests: EventGuest[] }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tint }} />
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: tokens.color.textSecondary,
            letterSpacing: 0.5,
          }}
        >
          {label.toUpperCase()} · {guests.length}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: tokens.color.bgPrimary,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
          overflow: 'hidden',
        }}
      >
        {guests.map((g, idx) => (
          <GuestRow key={g.memberId} guest={g} last={idx === guests.length - 1} />
        ))}
      </View>
    </View>
  );
}

function GuestRow({ guest, last }: { guest: EventGuest; last: boolean }) {
  const m = getAnyMember(guest.memberId);
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: tokens.color.borderSubtle,
      }}
    >
      <Avatar member={m} size="md" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: tokens.color.textPrimary }}>
            {m.name}
          </Text>
          {guest.isHost && (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                backgroundColor: tokens.color.accentGold + '22',
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: tokens.color.accentGold }}>
                HOST
              </Text>
            </View>
          )}
          {guest.pendingInvite && (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                backgroundColor: tokens.color.bgTinted,
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: tokens.color.textMuted }}>
                INVITE PENDING
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
          {m.relationship}
        </Text>
      </View>
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

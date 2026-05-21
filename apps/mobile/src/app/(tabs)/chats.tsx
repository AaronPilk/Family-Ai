import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  MEMBERS,
  ME,
  getAnyMember,
  type FamilyEvent,
  type MomentMessage,
  type MemberId,
} from '../../lib/mockData';
import { useEventsInBranches } from '../../lib/eventStore';
import { useScopedBranchIds } from '../../lib/branchStore';

/**
 * Chats tab — every active group chat in one place. For v0 each row is an
 * event's group chat. In later batches this'll also hold 1:1 threads with
 * individual family members.
 *
 * Sorted by most-recent message. Tap a row → /moment/[id]/chat.
 */
export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const scopedIds = useScopedBranchIds();
  const events = useEventsInBranches(scopedIds);

  // Surface every event that has any activity OR is upcoming.
  const chats = events
    .filter((e) => e.activity.length > 0 || e.status !== 'past')
    .sort((a, b) => {
      const am = lastMessage(a);
      const bm = lastMessage(b);
      const at = am?.at ?? a.startsAt + 'T00:00:00Z';
      const bt = bm?.at ?? b.startsAt + 'T00:00:00Z';
      return bt.localeCompare(at);
    });

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 18,
        }}
      >
        {/* Header */}
        <View>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: tokens.color.accentPrimary,
              letterSpacing: 1.5,
            }}
          >
            CONVERSATIONS
          </Text>
          <Text style={{ fontSize: 28, fontWeight: '700', color: tokens.color.textPrimary }}>
            Chats
          </Text>
          <Text style={{ fontSize: 14, color: tokens.color.textMuted, marginTop: 4 }}>
            Every event has its own group chat. Tap to jump in.
          </Text>
        </View>

        {/* Chat list */}
        {chats.length > 0 ? (
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              overflow: 'hidden',
            }}
          >
            {chats.map((e, idx) => (
              <ChatRow key={e.id} event={e} last={idx === chats.length - 1} />
            ))}
          </View>
        ) : (
          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              padding: 24,
              borderRadius: 18,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
              No active chats
            </Text>
            <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
              Start a reunion, vacation, or gathering — its group chat lands here.
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

function ChatRow({ event, last }: { event: FamilyEvent; last: boolean }) {
  const latest = lastMessage(event);
  const preview = latest ? messagePreview(latest) : null;
  const others = event.activity.filter((m) => m.authorId !== ME).length;

  return (
    <Pressable
      onPress={() => router.push(`/moment/${event.id}/chat`)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* Event glyph in cover-tint disc */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: event.coverTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 24 }}>{event.coverGlyph}</Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}
          >
            {event.title}
          </Text>
          {latest?.whenAgo && (
            <Text style={{ fontSize: 11, color: tokens.color.textMuted, fontWeight: '600' }}>
              {latest.whenAgo}
            </Text>
          )}
        </View>
        {preview ? (
          <Text
            numberOfLines={1}
            style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 18 }}
          >
            {preview}
          </Text>
        ) : (
          <Text style={{ fontSize: 13, color: tokens.color.textMuted, lineHeight: 18 }}>
            No messages yet — send the first one.
          </Text>
        )}
        {event.branchIds.length > 1 && (
          <Text
            style={{
              fontSize: 10,
              color: tokens.color.accentPrimary,
              fontWeight: '700',
              letterSpacing: 0.8,
              marginTop: 2,
            }}
          >
            CROSS-BRANCH
          </Text>
        )}
      </View>

      {/* Right side: count chip or arrow */}
      {others > 0 ? (
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 4,
            backgroundColor: tokens.color.accentPrimary + '18',
            borderRadius: 999,
          }}
        >
          <Text style={{ fontSize: 11, color: tokens.color.accentPrimary, fontWeight: '700' }}>
            {others}
          </Text>
        </View>
      ) : (
        <Text style={{ fontSize: 20, color: tokens.color.textMuted }}>›</Text>
      )}
    </Pressable>
  );
}

function lastMessage(e: FamilyEvent): MomentMessage | undefined {
  return e.activity[e.activity.length - 1];
}

function messagePreview(m: MomentMessage): string {
  const author = MEMBERS[m.authorId as MemberId];
  const name = author ? author.name : getAnyMember(m.authorId).name;
  const prefix = m.authorId === ME ? 'You' : name;
  return `${prefix}: ${m.body}`;
}

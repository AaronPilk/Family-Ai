import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../theme/tokens';
import { getAnyMember, type MomentMessage, type AnyMemberId } from '../../../lib/mockData';
import {
  useEvent,
  sendEventMessage,
  useHydrateEventsFromSupabase,
} from '../../../lib/eventStore';
import { useMyUserId } from '../../../lib/sessionStore';
import { userIdToMemberId, getCachedDisplayName } from '../../../lib/supabaseEvents';
import { Avatar } from '../../../components/Avatar';

/**
 * Group chat scoped to a single event. iMessage-style bubbles:
 *  - own messages right-aligned, accent color
 *  - others left-aligned, soft grey, avatar shown on the LAST message of a
 *    streak (so the avatar sits at the bottom of the visual cluster)
 *  - date separators ("Today", "Yesterday", weekday, full date) between
 *    consecutive messages spanning days
 *  - tappable header opens the guests list
 *  - typing indicator placeholder (cosmetic until real presence wires in)
 *
 * For Reunion Mode v0 this is in-app only. The Twilio SMS bridge (PartyFull-
 * style) lands in a later batch — when it does, this exact same activity
 * feed becomes the source of truth for both surfaces.
 */
export default function EventChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  // Hydrate from Supabase in case the user deep-linked into the chat before
  // visiting the events tab. Without this, deep-links land on a blank screen
  // because the store is empty until something kicks off the fetch.
  useHydrateEventsFromSupabase();
  const event = useEvent(id ?? '');
  const myUuid = useMyUserId();
  const myMemberId = myUuid ? userIdToMemberId(myUuid) : null;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom on mount + whenever the message list changes.
  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  }, [event?.activity.length]);

  // Cosmetic typing indicator was previously seeded from mock guests; now that
  // the guest roster is real, we just skip the placeholder. (Real presence
  // wiring is a future batch.)
  const typingFrom = useMemo(() => null as AnyMemberId | null, []);
  const [typingVisible, setTypingVisible] = useState(false);
  useEffect(() => {
    if (!typingFrom) return;
    const t = setTimeout(() => setTypingVisible(false), 4200);
    return () => clearTimeout(t);
  }, [typingFrom]);

  // Demo events live only in demoData.ts (id prefix `demo_event_`) — never
  // in the real store. Block the chat surface entirely so users can't "send"
  // messages that go nowhere; nudge them to invite real family instead.
  if ((id ?? '').startsWith('demo_event_')) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.color.bgSecondary,
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
        }}
      >
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
            opacity: pressed ? 0.5 : 1,
            marginBottom: 24,
          })}
        >
          <Text style={{ fontSize: 20, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
        </Pressable>
        <View
          style={{
            backgroundColor: tokens.color.accentPrimary + '15',
            borderWidth: 1,
            borderColor: tokens.color.accentPrimary + '30',
            borderRadius: 18,
            padding: 22,
            gap: 10,
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 8,
              paddingVertical: 3,
              backgroundColor: tokens.color.accentPrimary,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 11, letterSpacing: 0.8 }}>
              DEMO
            </Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: tokens.color.textPrimary }}>
            This is demo content
          </Text>
          <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
            Invite family to start real conversations. The demo chat goes away the moment someone
            joins your circle.
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
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: 'white', fontWeight: '700' }}>Invite family →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Show an explicit loading / not-found state instead of a blank screen.
  // The previous `return null` left the user staring at nothing with no way
  // back when they deep-linked to a chat before the store hydrated.
  if (!event) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.color.bgSecondary,
          paddingTop: insets.top,
          paddingHorizontal: 24,
          gap: 14,
        }}
      >
        <Text style={{ fontSize: 15, color: tokens.color.textMuted, textAlign: 'center' }}>
          Loading chat…
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: tokens.color.bgPrimary,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 14, color: tokens.color.textPrimary, fontWeight: '600' }}>
            ‹ Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    setDraft('');
    try {
      await sendEventMessage(event.id, body);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      // Restore the draft so the user can retry, and surface the error to the
      // user. Silently dropping the message would be the worst-case bug for
      // family-group chat — people would think their message went through.
      setDraft(body);
      setSendError(
        err instanceof Error && err.message
          ? `Couldn't send: ${err.message}`
          : "Couldn't send your message. Tap send to try again.",
      );
      // eslint-disable-next-line no-console
      console.warn('[chat] send failed:', err);
    } finally {
      setSending(false);
    }
  };

  // Build display list interleaved with date separators.
  const items = buildItems(event.activity, myMemberId);
  const going = event.guests.filter((g) => g.rsvp === 'going');
  const recentSenders = uniqueRecentSenders(event.activity, 5);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <Pressable
        onPress={() => router.push(`/moment/${event.id}/guests`)}
        style={({ pressed }) => ({
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 14,
          backgroundColor: tokens.color.bgPrimary,
          borderBottomWidth: 1,
          borderBottomColor: tokens.color.borderSubtle,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: tokens.color.bgSecondary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 22, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}
            >
              {event.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={{ flexDirection: 'row' }}>
                {recentSenders.map((mid, i) => (
                  <View
                    key={mid}
                    style={{
                      marginLeft: i === 0 ? 0 : -6,
                      borderWidth: 1.5,
                      borderColor: tokens.color.bgPrimary,
                      borderRadius: 999,
                    }}
                  >
                    <Avatar member={getAnyMember(mid)} size="sm" />
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>
                · {going.length} going
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 22, color: tokens.color.textMuted }}>›</Text>
        </View>
      </Pressable>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: 14,
          gap: 4,
        }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {items.map((item, i) => {
          if (item.kind === 'separator') {
            return <DateSeparator key={`sep-${i}`} label={item.label} />;
          }
          return (
            <ChatBubble
              key={item.msg.id}
              msg={item.msg}
              first={item.first}
              last={item.last}
              myMemberId={myMemberId}
            />
          );
        })}

        {typingVisible && typingFrom && <TypingBubble memberId={typingFrom as AnyMemberId} />}

        {event.activity.length === 0 && (
          <View
            style={{
              padding: 24,
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 18,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
              No messages yet
            </Text>
            <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
              Be the first one in — say hi, share logistics, drop a meme. Everyone going to{' '}
              {event.title} will see it.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Inline send error — surfaces RLS / network failures so the user knows
          their message didn't go through. The draft is restored above so they
          can retry without retyping. */}
      {sendError && (
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor: tokens.color.danger + '18',
            borderTopWidth: 1,
            borderTopColor: tokens.color.danger + '40',
          }}
        >
          <Text style={{ fontSize: 12, color: tokens.color.danger }}>{sendError}</Text>
        </View>
      )}

      {/* Composer */}
      <View
        style={{
          paddingHorizontal: 10,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: tokens.color.bgPrimary,
          borderTopWidth: 1,
          borderTopColor: tokens.color.borderSubtle,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => {}}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: tokens.color.bgSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 18, color: tokens.color.textMuted }}>+</Text>
        </Pressable>
        <View
          style={{
            flex: 1,
            minHeight: 38,
            maxHeight: 140,
            backgroundColor: tokens.color.bgSecondary,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
            justifyContent: 'center',
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            placeholderTextColor={tokens.color.textMuted}
            multiline
            style={{
              fontSize: 16,
              color: tokens.color.textPrimary,
              lineHeight: 21,
              maxHeight: 120,
            }}
            onSubmitEditing={submit}
            blurOnSubmit={false}
          />
        </View>
        <Pressable
          onPress={submit}
          disabled={draft.trim().length === 0}
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: draft.trim().length === 0 ? '#D8C7CC' : tokens.color.accentPrimary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '800', marginTop: -2 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---- Display item construction --------------------------------------------

type DisplayItem =
  | { kind: 'separator'; label: string }
  | { kind: 'message'; msg: MomentMessage; first: boolean; last: boolean };

function buildItems(msgs: MomentMessage[], _myMemberId: AnyMemberId | null): DisplayItem[] {
  const out: DisplayItem[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]!;
    const prev = msgs[i - 1];
    const next = msgs[i + 1];

    // Date separator when the day changes between prev and current.
    const prevDay = prev?.at ? dayKey(prev.at) : null;
    const curDay = m.at ? dayKey(m.at) : null;
    if (curDay && curDay !== prevDay) {
      out.push({ kind: 'separator', label: dayLabel(m.at!) });
    }

    // Grouping: first/last in a same-author streak (also bounded by separators).
    const dayChanges = Boolean(next?.at && curDay && dayKey(next.at) !== curDay);
    const first = !prev || prev.authorId !== m.authorId || prevDay !== curDay;
    const last = !next || next.authorId !== m.authorId || dayChanges;

    out.push({ kind: 'message', msg: m, first, last });
  }
  return out;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const ms = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((atMidnight(now).getTime() - atMidnight(d).getTime()) / ms);
  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff >= 2 && daysDiff <= 6) {
    return d.toLocaleDateString(undefined, { weekday: 'long' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function atMidnight(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function uniqueRecentSenders(msgs: MomentMessage[], limit: number): AnyMemberId[] {
  const seen = new Set<AnyMemberId>();
  const out: AnyMemberId[] = [];
  for (let i = msgs.length - 1; i >= 0 && out.length < limit; i--) {
    const a = msgs[i]!.authorId;
    if (!seen.has(a)) {
      seen.add(a);
      out.push(a);
    }
  }
  return out;
}

// ---- Sub-components -------------------------------------------------------

function DateSeparator({ label }: { label: string }) {
  return (
    <View style={{ alignItems: 'center', marginVertical: 12 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: tokens.color.textMuted,
          letterSpacing: 0.8,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function ChatBubble({
  msg,
  first,
  last,
  myMemberId,
}: {
  msg: MomentMessage;
  first: boolean;
  last: boolean;
  myMemberId: AnyMemberId | null;
}) {
  const isMine = myMemberId != null && msg.authorId === myMemberId;
  const cachedName = getCachedDisplayName(msg.authorId as `user_${string}`);
  const fallback = getAnyMember(msg.authorId);
  const author = {
    name: cachedName || fallback.name,
    initials: (cachedName?.[0] ?? fallback.initials).toUpperCase(),
    color: fallback.color,
    relationship: fallback.relationship,
  };
  if (isMine) {
    return (
      <View style={{ alignSelf: 'flex-end', maxWidth: '78%', alignItems: 'flex-end' }}>
        <View
          style={{
            backgroundColor: tokens.color.accentPrimary,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 20,
            borderBottomRightRadius: last ? 6 : 20,
            borderTopRightRadius: first ? 20 : 6,
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, lineHeight: 21 }}>{msg.body}</Text>
        </View>
        {last && (
          <Text
            style={{ fontSize: 10, color: tokens.color.textMuted, marginTop: 3, marginRight: 4 }}
          >
            {msg.whenAgo}
          </Text>
        )}
      </View>
    );
  }
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        maxWidth: '82%',
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      <View style={{ width: 32 }}>{last && <Avatar member={author} size="sm" />}</View>
      <View style={{ flex: 0, alignItems: 'flex-start' }}>
        {first && (
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: author.color,
              marginBottom: 3,
              marginLeft: 12,
            }}
          >
            {author.name}
          </Text>
        )}
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 20,
            borderBottomLeftRadius: last ? 6 : 20,
            borderTopLeftRadius: first ? 20 : 6,
          }}
        >
          <Text style={{ color: tokens.color.textPrimary, fontSize: 16, lineHeight: 21 }}>
            {msg.body}
          </Text>
        </View>
        {last && (
          <Text
            style={{ fontSize: 10, color: tokens.color.textMuted, marginTop: 3, marginLeft: 12 }}
          >
            {msg.whenAgo}
          </Text>
        )}
      </View>
    </View>
  );
}

function TypingBubble({ memberId }: { memberId: AnyMemberId }) {
  const m = getAnyMember(memberId);
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        maxWidth: '60%',
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginTop: 4,
      }}
    >
      <View style={{ width: 32 }}>
        <Avatar member={m} size="sm" />
      </View>
      <View
        style={{
          backgroundColor: tokens.color.bgPrimary,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 20,
          borderBottomLeftRadius: 6,
          flexDirection: 'row',
          gap: 4,
        }}
      >
        <Dot />
        <Dot delay={150} />
        <Dot delay={300} />
        <Text style={{ marginLeft: 6, fontSize: 12, color: tokens.color.textMuted }}>
          {m.name} is typing…
        </Text>
      </View>
    </View>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  // Static dot for v0; animation would need Reanimated which adds complexity.
  // Keeping the dot static still reads as "typing indicator" in context.
  return (
    <View
      style={{
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: tokens.color.textMuted,
        opacity: 0.4 + (delay % 300) / 600,
      }}
    />
  );
}

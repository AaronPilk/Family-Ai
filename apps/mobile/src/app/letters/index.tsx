/**
 * Letters home — segmented "Sent | Received" with two lists.
 *
 * Sent: each row pulls from the sender-safe view. Status pill is "Delivered"
 * or "Read 2h ago" — never the raw read_at when the recipient chose "no".
 *
 * Received: each row pulls from the base table for incoming letters. Unread
 * rows are bold with a small dot; tapping opens the recipient view, which
 * silently calls markLetterRead on mount.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  type Letter,
  type LetterForSender,
  getCachedDisplayNameForUser,
  listLettersFromMe,
  listLettersToMe,
  senderStatusLabel,
  subscribeToMyLetterChanges,
  whenAgoFromIso,
} from '../../lib/supabaseLetters';

type TabKey = 'sent' | 'received';

export default function LettersIndex() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('received');
  const [sent, setSent] = useState<LetterForSender[]>([]);
  const [received, setReceived] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [s, r] = await Promise.all([listLettersFromMe(), listLettersToMe()]);
    setSent(s);
    setReceived(r);
    setLoading(false);
  }, []);

  // Re-fetch every time the screen comes into focus — Letters is a low-traffic
  // surface and the cost is tiny vs the cost of showing stale "Delivered" when
  // the recipient flipped to "yes" five minutes ago.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      refresh().catch(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [refresh]),
  );

  // Realtime: keep the sender's list fresh while they're sitting on the
  // screen. We re-fetch via the view (never trust raw payload) on any change.
  useEffect(() => {
    const unsubscribe = subscribeToMyLetterChanges(() => {
      refresh().catch(() => {});
    });
    return unsubscribe;
  }, [refresh]);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <Header insetTop={insets.top} />
      <Segmented tab={tab} onChange={setTab} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={tokens.color.accentPrimary} />
        </View>
      ) : tab === 'sent' ? (
        <SentList sent={sent} insetBottom={insets.bottom} />
      ) : (
        <ReceivedList received={received} insetBottom={insets.bottom} />
      )}

      {tab === 'sent' && (
        <Pressable
          onPress={() => router.push('/letters/compose')}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 20,
            bottom: insets.bottom + 24,
            paddingHorizontal: 18,
            paddingVertical: 14,
            backgroundColor: tokens.color.accentPrimary,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            opacity: pressed ? 0.85 : 1,
            shadowColor: tokens.color.accentPrimary,
            shadowOpacity: 0.25,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
          })}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
            + Write a letter
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ---- Header + segmented ----------------------------------------------------

function Header({ insetTop }: { insetTop: number }) {
  return (
    <View
      style={{
        paddingTop: insetTop + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: tokens.color.borderSubtle,
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
        })}
      >
        <Text style={{ fontSize: 20, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.color.textPrimary }}>
          Letters
        </Text>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 1 }}>
          Private, one-shot messages
        </Text>
      </View>
    </View>
  );
}

function Segmented({
  tab,
  onChange,
}: {
  tab: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: tokens.color.bgTinted,
        borderRadius: 999,
        padding: 4,
        gap: 4,
      }}
    >
      {(['received', 'sent'] as TabKey[]).map((key) => (
        <Pressable
          key={key}
          onPress={() => onChange(key)}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor:
              tab === key ? tokens.color.bgPrimary : 'transparent',
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color:
                tab === key ? tokens.color.textPrimary : tokens.color.textMuted,
            }}
          >
            {key === 'received' ? 'Received' : 'Sent'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---- Lists -----------------------------------------------------------------

function SentList({
  sent,
  insetBottom,
}: {
  sent: LetterForSender[];
  insetBottom: number;
}) {
  if (sent.length === 0) {
    return (
      <EmptyState
        title="You haven’t written any letters."
        body="Letters are for the things hardest to say in person. Take your time."
        ctaLabel="+ Write a letter"
        onCta={() => router.push('/letters/compose')}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        paddingBottom: insetBottom + 120,
        gap: 10,
      }}
    >
      {sent.map((letter) => (
        <SentRow key={letter.id} letter={letter} />
      ))}
    </ScrollView>
  );
}

function SentRow({ letter }: { letter: LetterForSender }) {
  const recipientName =
    getCachedDisplayNameForUser(letter.recipientUserId) || 'Family member';
  const status = senderStatusLabel(letter);
  const statusIsRead = Boolean(letter.visibleReadAt);
  const preview = letter.body.replace(/\s+/g, ' ').slice(0, 60);
  const sentLabel = whenAgoFromIso(letter.sentAt);

  return (
    <Pressable
      onPress={() => router.push(`/letters/sender/${letter.id}`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.7 : 1,
        gap: 8,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text
          style={{ fontSize: 15, fontWeight: '700', color: tokens.color.textPrimary }}
          numberOfLines={1}
        >
          To {recipientName}
        </Text>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>{sentLabel}</Text>
      </View>
      <Text
        style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}
        numberOfLines={2}
      >
        {preview}
        {letter.body.length > 60 ? '…' : ''}
      </Text>
      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          backgroundColor: statusIsRead
            ? tokens.color.accentPrimary + '18'
            : tokens.color.bgTinted,
          borderRadius: 999,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: statusIsRead
              ? tokens.color.accentPrimary
              : tokens.color.textSecondary,
          }}
        >
          {status}
        </Text>
      </View>
    </Pressable>
  );
}

function ReceivedList({
  received,
  insetBottom,
}: {
  received: Letter[];
  insetBottom: number;
}) {
  if (received.length === 0) {
    return (
      <EmptyState
        title="No letters yet."
        body="When someone sends you a letter, it lands here — quiet and private. You choose whether they ever know you read it."
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        paddingBottom: insetBottom + 40,
        gap: 10,
      }}
    >
      {received.map((letter) => (
        <ReceivedRow key={letter.id} letter={letter} />
      ))}
    </ScrollView>
  );
}

function ReceivedRow({ letter }: { letter: Letter }) {
  const senderName =
    getCachedDisplayNameForUser(letter.senderUserId) || 'Family member';
  const unread = letter.readAt == null;
  const preview = letter.body.replace(/\s+/g, ' ').slice(0, 60);
  const sentLabel = whenAgoFromIso(letter.sentAt);

  return (
    <Pressable
      onPress={() => router.push(`/letters/${letter.id}`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: unread
          ? tokens.color.accentPrimary + '40'
          : tokens.color.borderSubtle,
        opacity: pressed ? 0.7 : 1,
        gap: 8,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          {unread && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: tokens.color.accentPrimary,
              }}
            />
          )}
          <Text
            style={{
              fontSize: 15,
              fontWeight: unread ? '700' : '600',
              color: tokens.color.textPrimary,
            }}
            numberOfLines={1}
          >
            From {senderName}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>{sentLabel}</Text>
      </View>
      <Text
        style={{
          fontSize: 14,
          color: unread ? tokens.color.textPrimary : tokens.color.textSecondary,
          fontWeight: unread ? '600' : '400',
          lineHeight: 20,
        }}
        numberOfLines={2}
      >
        {preview}
        {letter.body.length > 60 ? '…' : ''}
      </Text>
    </Pressable>
  );
}

// ---- Empty state -----------------------------------------------------------

function EmptyState({
  title,
  body,
  ctaLabel,
  onCta,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <View
        style={{
          backgroundColor: tokens.color.bgTinted,
          padding: 24,
          borderRadius: 18,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
          {title}
        </Text>
        <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 21 }}>
          {body}
        </Text>
        {ctaLabel && onCta && (
          <Pressable
            onPress={onCta}
            style={({ pressed }) => ({
              marginTop: 8,
              alignSelf: 'flex-start',
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: tokens.color.accentPrimary,
              borderRadius: 999,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>{ctaLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

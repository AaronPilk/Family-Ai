/**
 * Personal timeline — the chronological feed of one family member's answered
 * questions. Each row is a question (muted) plus their answer (primary),
 * with a relative timestamp.
 *
 * RLS controls access: a viewer only sees memory_items the policies allow,
 * which means signed-in family-circle members reading each other's stories,
 * or a user reading their own. If someone follows a link they shouldn't see,
 * the query returns zero rows and we show the empty state.
 */

import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import { useMyUserId } from '../../lib/sessionStore';
import {
  fetchMyTimeline,
  SupabaseMemoryError,
  type MemoryAnswer,
} from '../../lib/supabaseMemory';

export default function PersonalTimelineScreen() {
  const insets = useSafeAreaInsets();
  const { userId: routeUserId } = useLocalSearchParams<{ userId: string }>();
  const myId = useMyUserId();

  // Treat `/timeline/me` as a shortcut.
  const targetId = !routeUserId || routeUserId === 'me' ? myId : routeUserId;
  const isSelf = targetId != null && targetId === myId;

  const [items, setItems] = useState<MemoryAnswer[]>([]);
  const [displayName, setDisplayName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!targetId) {
      setLoading(false);
      return;
    }
    setErr(null);
    try {
      // Run timeline + name in parallel.
      const [rows, profileRes] = await Promise.all([
        fetchMyTimeline(targetId),
        supabase.from('profiles').select('display_name').eq('user_id', targetId).maybeSingle(),
      ]);
      setItems(rows);
      if (profileRes.data?.display_name) {
        setDisplayName(profileRes.data.display_name as string);
      }
    } catch (e) {
      const msg =
        e instanceof SupabaseMemoryError
          ? e.message
          : "Couldn't load this timeline. Try again in a moment.";
      setErr(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (!targetId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: tokens.color.textMuted }}>Sign in to view a timeline.</Text>
      </View>
    );
  }

  const headerTitle = isSelf
    ? 'Your timeline'
    : displayName
      ? `${displayName}'s timeline`
      : 'Their timeline';

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 60,
          gap: 18,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.color.accentPrimary}
          />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
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
            <Text style={{ fontSize: 20, color: tokens.color.textPrimary }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: tokens.color.textPrimary }}>
              {headerTitle}
            </Text>
            <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
              {items.length} {items.length === 1 ? 'memory' : 'memories'} shared
            </Text>
          </View>
        </View>

        {err && (
          <View style={{ backgroundColor: '#FFEDED', borderRadius: 14, padding: 14 }}>
            <Text style={{ color: tokens.color.danger, fontSize: 14 }}>{err}</Text>
          </View>
        )}

        {loading ? (
          <View
            style={{
              minHeight: 220,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator color={tokens.color.accentPrimary} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            isSelf={isSelf}
            displayName={displayName}
            onAnswer={() => router.push('/answer/today')}
          />
        ) : (
          <View style={{ gap: 14 }}>
            {items.map((item) => (
              <TimelineCard key={item.id} item={item} />
            ))}
          </View>
        )}

        {/* CTA on self-timeline to keep answering */}
        {isSelf && !loading && items.length > 0 && (
          <Pressable
            onPress={() => router.push('/answer/today')}
            style={({ pressed }) => ({
              marginTop: 8,
              backgroundColor: tokens.color.accentPrimary,
              borderRadius: 999,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
              Answer another question
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function TimelineCard({ item }: { item: MemoryAnswer }) {
  const when = relativeTime(item.createdAt);
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 20,
        padding: 18,
        gap: 10,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          color: tokens.color.textMuted,
          fontStyle: 'italic',
          lineHeight: 20,
        }}
      >
        {item.question?.body ?? 'A question'}
      </Text>
      <Text
        style={{
          fontSize: 17,
          color: tokens.color.textPrimary,
          lineHeight: 26,
        }}
      >
        {item.body}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: tokens.color.textMuted,
          marginTop: 2,
        }}
      >
        answered {when}
      </Text>
    </View>
  );
}

function EmptyState({
  isSelf,
  displayName,
  onAnswer,
}: {
  isSelf: boolean;
  displayName: string;
  onAnswer: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 24,
        padding: 28,
        gap: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
      }}
    >
      <Text style={{ fontSize: 40 }}>📔</Text>
      <Text
        style={{
          fontSize: 20,
          fontWeight: '700',
          color: tokens.color.textPrimary,
          textAlign: 'center',
        }}
      >
        {isSelf
          ? 'Answer your first question to start your timeline.'
          : `${displayName || 'They'} haven't shared a memory yet.`}
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: tokens.color.textSecondary,
          textAlign: 'center',
          lineHeight: 22,
        }}
      >
        {isSelf
          ? 'Every answer becomes a chapter your family will read for years.'
          : 'Give them a gentle nudge with a good question — and they\'ll start filling this in.'}
      </Text>
      {isSelf && (
        <Pressable
          onPress={onAnswer}
          style={({ pressed }) => ({
            backgroundColor: tokens.color.accentPrimary,
            paddingHorizontal: 22,
            paddingVertical: 12,
            borderRadius: 999,
            opacity: pressed ? 0.85 : 1,
            marginTop: 6,
          })}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>Answer your first</Text>
        </Pressable>
      )}
    </View>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const sec = Math.max(1, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} ${min === 1 ? 'minute' : 'minutes'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${hr === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

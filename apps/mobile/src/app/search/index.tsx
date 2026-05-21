import { useState, useMemo } from 'react';
import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  FEED,
  MEMBERS,
  MEMBER_LIST,
  TOPICS,
  MOMENTS,
  type FeedItem,
} from '../../lib/mockData';
import { useScopedBranchIds } from '../../lib/branchStore';
import { Avatar } from '../../components/Avatar';

const RECENT = ['chicken biskit', 'kids', 'love', 'recipe'];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const scopedIds = useScopedBranchIds();
  const [q, setQ] = useState('');

  const ql = q.trim().toLowerCase();

  const memoryHits = useMemo(() => {
    if (!ql) return [];
    return FEED.filter((f) => scopedIds.includes(f.branchId))
      .filter(
        (f) =>
          (f.body && f.body.toLowerCase().includes(ql)) ||
          (f.topic && f.topic.toLowerCase().includes(ql)) ||
          (f.mediaCaption && f.mediaCaption.toLowerCase().includes(ql)),
      );
  }, [ql, scopedIds]);

  const peopleHits = useMemo(() => {
    if (!ql) return [];
    return MEMBER_LIST.filter(
      (m) =>
        m.name.toLowerCase().includes(ql) || m.relationship.toLowerCase().includes(ql),
    );
  }, [ql]);

  const topicHits = useMemo(() => {
    if (!ql) return [];
    return TOPICS.filter((t) => t.label.toLowerCase().includes(ql));
  }, [ql]);

  const momentHits = useMemo(() => {
    if (!ql) return [];
    return MOMENTS.filter(
      (m) =>
        scopedIds.includes(m.branchId) &&
        (m.title.toLowerCase().includes(ql) || m.subtitle.toLowerCase().includes(ql)),
    );
  }, [ql, scopedIds]);

  const totalHits = memoryHits.length + peopleHits.length + topicHits.length + momentHits.length;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: tokens.color.bgSecondary,
          borderBottomWidth: 1,
          borderBottomColor: tokens.color.borderSubtle,
          gap: 10,
        }}
      >
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
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={{ fontSize: 20, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.color.textPrimary }}>
            Search
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            paddingHorizontal: 12,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="What did Mom say about snacks…"
            placeholderTextColor={tokens.color.textMuted}
            autoFocus
            style={{
              flex: 1,
              height: 44,
              fontSize: 16,
              color: tokens.color.textPrimary,
            }}
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Text style={{ color: tokens.color.textMuted, fontSize: 18 }}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
          gap: 22,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {!ql && (
          <>
            <Section title="Recent">
              <View style={{ gap: 8 }}>
                {RECENT.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setQ(r)}
                    style={({ pressed }) => ({
                      padding: 12,
                      backgroundColor: tokens.color.bgPrimary,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: tokens.color.borderSubtle,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 14 }}>🕘</Text>
                    <Text style={{ flex: 1, fontSize: 15, color: tokens.color.textPrimary }}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            </Section>
            <Section title="Try a question">
              <View style={{ gap: 8 }}>
                {[
                  'What did Mom eat as a kid?',
                  'Stories about Grandma',
                  'Songs Dad liked at my age',
                  'Holiday memories',
                ].map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setQ(s.toLowerCase().slice(0, 30))}
                    style={({ pressed }) => ({
                      padding: 12,
                      backgroundColor: tokens.color.bgTinted,
                      borderRadius: 12,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 14, color: tokens.color.accentPrimary, fontWeight: '600' }}>
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Section>
          </>
        )}

        {ql && totalHits === 0 && (
          <View
            style={{
              padding: 24,
              alignItems: 'center',
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
            }}
          >
            <Text style={{ fontSize: 15, color: tokens.color.textSecondary, textAlign: 'center' }}>
              No matches for "{q}".
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: tokens.color.textMuted,
                textAlign: 'center',
                marginTop: 6,
              }}
            >
              Try a different word — search runs across questions, answers, photos, and transcripts.
            </Text>
          </View>
        )}

        {memoryHits.length > 0 && (
          <Section title={`Memories · ${memoryHits.length}`}>
            <View style={{ gap: 10 }}>
              {memoryHits.map((m) => (
                <MemoryHit key={m.id} item={m} />
              ))}
            </View>
          </Section>
        )}

        {peopleHits.length > 0 && (
          <Section title={`People · ${peopleHits.length}`}>
            <View style={{ gap: 8 }}>
              {peopleHits.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => router.push(`/member/${m.id}`)}
                  style={({ pressed }) => ({
                    padding: 12,
                    backgroundColor: tokens.color.bgPrimary,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: tokens.color.borderSubtle,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Avatar member={m} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.color.textPrimary }}>
                      {m.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
                      {m.relationship}
                    </Text>
                  </View>
                  <Text style={{ color: tokens.color.textMuted, fontSize: 18 }}>›</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        )}

        {topicHits.length > 0 && (
          <Section title={`Topics · ${topicHits.length}`}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {topicHits.map((t) => (
                <Pressable
                  key={t.slug}
                  onPress={() => router.push(`/topic/${t.slug}`)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: tokens.color.bgTinted,
                    borderRadius: 999,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 13, color: tokens.color.accentPrimary, fontWeight: '700' }}>
                    {t.label} · {t.count}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>
        )}

        {momentHits.length > 0 && (
          <Section title={`Moments · ${momentHits.length}`}>
            <View style={{ gap: 10 }}>
              {momentHits.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => router.push(`/moment/${m.id}`)}
                  style={({ pressed }) => ({
                    padding: 12,
                    backgroundColor: tokens.color.bgPrimary,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: tokens.color.borderSubtle,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      backgroundColor: m.coverTint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{m.coverGlyph}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.color.textPrimary }}>
                      {m.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
                      {m.dateRangeText}
                    </Text>
                  </View>
                  <Text style={{ color: tokens.color.textMuted, fontSize: 18 }}>›</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

function MemoryHit({ item }: { item: FeedItem }) {
  const author = MEMBERS[item.authorId];
  return (
    <Pressable
      onPress={() => router.push(`/memory/${item.id}`)}
      style={({ pressed }) => ({
        padding: 12,
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Avatar member={author} size="sm" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>
          {author.relationship} · {item.whenAgo}
          {item.topic ? ` · ${item.topic}` : ''}
        </Text>
        <Text
          numberOfLines={2}
          style={{ fontSize: 14, color: tokens.color.textPrimary, marginTop: 4, lineHeight: 20 }}
        >
          {item.body}
        </Text>
      </View>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: tokens.color.textSecondary,
          letterSpacing: 0.5,
        }}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

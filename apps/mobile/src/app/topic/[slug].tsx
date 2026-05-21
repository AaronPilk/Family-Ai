import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { FEED, MEMBERS, BRANCHES, TOPICS, type FeedItem } from '../../lib/mockData';
import { useScopedBranchIds } from '../../lib/branchStore';
import { Avatar } from '../../components/Avatar';

export default function TopicTimeline() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const scopedIds = useScopedBranchIds();
  const topic = TOPICS.find((t) => t.slug === slug);
  const label = topic?.label ?? slug ?? 'Topic';

  // Filter memories by topic label (case-insensitive) within scope
  const items = FEED.filter(
    (f) =>
      scopedIds.includes(f.branchId) &&
      f.topic &&
      f.topic.toLowerCase() === label.toLowerCase(),
  );

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: tokens.color.bgSecondary,
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
          <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.color.accentPrimary, letterSpacing: 1.5 }}>
            TOPIC TIMELINE
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: tokens.color.textPrimary }}>
            {label}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
          gap: 14,
        }}
      >
        <Text style={{ fontSize: 13, color: tokens.color.textMuted, fontStyle: 'italic' }}>
          {items.length === 0
            ? `Nothing tagged "${label}" yet. As your family adds memories, AI will sort them here.`
            : `${items.length} ${items.length === 1 ? 'memory' : 'memories'} your family has shared on this topic.`}
        </Text>
        {items.map((item) => (
          <TopicCard key={item.id} item={item} />
        ))}
      </ScrollView>
    </View>
  );
}

function TopicCard({ item }: { item: FeedItem }) {
  const author = MEMBERS[item.authorId];
  const branch = BRANCHES[item.branchId];
  return (
    <Pressable
      onPress={() => router.push(`/memory/${item.id}`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.8 : 1,
        gap: 10,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar member={author} size="sm" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.color.textPrimary }}>
            {author.name} <Text style={{ color: tokens.color.textMuted, fontWeight: '400' }}>· {author.relationship}</Text>
          </Text>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
            {item.whenAgo} · {branch.shortName}
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 15, color: tokens.color.textPrimary, lineHeight: 21 }}>
        {item.body}
      </Text>
    </Pressable>
  );
}

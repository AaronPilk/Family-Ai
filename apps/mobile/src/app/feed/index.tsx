import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { FEED, MEMBERS, BRANCHES, VISIBILITY_LABEL, type FeedItem } from '../../lib/mockData';
import {
  useScopedBranchIds,
  useSelection,
  useIsMultiBranch,
  useCurrentBranch,
} from '../../lib/branchStore';
import { Avatar } from '../../components/Avatar';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const scopedIds = useScopedBranchIds();
  const sel = useSelection();
  const isMulti = useIsMultiBranch();
  const branch = useCurrentBranch();
  const items = FEED.filter((f) => scopedIds.includes(f.branchId));

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
          <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.color.textPrimary }}>
            The whole feed
          </Text>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 1 }}>
            {isMulti && sel === 'all' ? 'Across all your family' : `In ${branch.shortName}`} ·{' '}
            {items.length} memories
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
        {items.map((item) => (
          <FeedCard key={item.id} item={item} showBranch={isMulti && sel === 'all'} />
        ))}
        <Text
          style={{
            textAlign: 'center',
            color: tokens.color.textMuted,
            fontSize: 13,
            marginTop: 8,
          }}
        >
          You're all caught up.
        </Text>
      </ScrollView>
    </View>
  );
}

function FeedCard({ item, showBranch }: { item: FeedItem; showBranch?: boolean }) {
  const author = MEMBERS[item.authorId];
  const branch = BRANCHES[item.branchId];
  return (
    <Pressable
      onPress={() => router.push(`/memory/${item.id}`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 20,
        padding: 16,
        opacity: pressed ? 0.85 : 1,
        shadowColor: '#1A1418',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar member={author} size="md" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', fontSize: 15, color: tokens.color.textPrimary }}>
            {author.name}{' '}
            <Text style={{ color: tokens.color.textMuted, fontWeight: '400' }}>
              · {author.relationship}
            </Text>
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>
              {item.kind === 'answer' && item.relatedToName
                ? `Answered ${item.relatedToName} · ${item.whenAgo}`
                : item.whenAgo}
            </Text>
            {showBranch && (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  backgroundColor: branch.color + '18',
                  borderRadius: 5,
                }}
              >
                <Text style={{ fontSize: 10, color: branch.color, fontWeight: '700' }}>
                  {branch.shortName}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            backgroundColor: '#FFE3EA',
            borderRadius: 999,
          }}
        >
          <Text style={{ color: tokens.color.accentPrimary, fontSize: 12, fontWeight: '700' }}>
            {VISIBILITY_LABEL[item.visibility]}
          </Text>
        </View>
      </View>
      <Text
        style={{ marginTop: 12, fontSize: 16, lineHeight: 24, color: tokens.color.textPrimary }}
      >
        {item.body}
      </Text>
      {item.mediaKind === 'photo' && (
        <View
          style={{
            marginTop: 12,
            height: 180,
            borderRadius: 14,
            backgroundColor: item.photoTint ?? tokens.color.bgTinted,
          }}
        />
      )}
      {(item.mediaKind === 'voice' || item.mediaKind === 'video') && (
        <View
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            backgroundColor: tokens.color.bgTinted,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: tokens.color.accentPrimary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 14 }}>▶</Text>
          </View>
          <Text style={{ fontSize: 13, color: tokens.color.textSecondary }}>
            {item.mediaKind === 'voice' ? 'Voice' : 'Video'} ·{' '}
            {Math.floor((item.durationSec ?? 0) / 60)}:
            {String((item.durationSec ?? 0) % 60).padStart(2, '0')}
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
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
    </Pressable>
  );
}

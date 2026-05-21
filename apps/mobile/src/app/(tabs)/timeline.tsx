import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  FEED,
  MEMBERS,
  BRANCHES,
  TOPICS,
  ME,
  type FeedItem,
  type MemberId,
} from '../../lib/mockData';
import {
  useCurrentBranch,
  useIsMultiBranch,
  useScopedBranchIds,
  useSelection,
} from '../../lib/branchStore';
import { Avatar } from '../../components/Avatar';
import { BranchSwitcher } from '../../components/BranchSwitcher';

type Segment = 'mine' | 'family' | 'people' | 'topics';
const SEGMENTS: Segment[] = ['mine', 'family', 'people', 'topics'];
const LABEL: Record<Segment, string> = {
  mine: 'Mine',
  family: 'Family',
  people: 'People',
  topics: 'Topics',
};

export default function TimelineScreen() {
  const insets = useSafeAreaInsets();
  const [seg, setSeg] = useState<Segment>('family');
  const branch = useCurrentBranch();
  const sel = useSelection();
  const isMulti = useIsMultiBranch();
  const scopedIds = useScopedBranchIds();

  const scopedFeed = FEED.filter((f) => scopedIds.includes(f.branchId));

  // For "Mine": only the user's authored items (and answers/questions they made)
  const mine = scopedFeed.filter((f) => f.authorId === ME || f.relatedToName === 'Aaron');

  // Members across in-scope branches
  const memberIds = Array.from(
    new Set(scopedIds.flatMap((bid) => BRANCHES[bid].memberIds)),
  ).filter((id) => id !== 'me') as MemberId[];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 14,
          backgroundColor: tokens.color.bgSecondary,
          gap: 10,
        }}
      >
        <BranchSwitcher />
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: tokens.color.accentPrimary,
            letterSpacing: 1.5,
          }}
        >
          THE STORY SO FAR
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: tokens.color.textPrimary }}>
          Timeline
        </Text>
        <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: -2 }}>
          {isMulti && sel === 'all'
            ? 'Across all your family'
            : `In ${branch.shortName}`}
        </Text>

        {/* Segmented control */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: tokens.color.bgTinted,
            borderRadius: 12,
            padding: 4,
            marginTop: 10,
          }}
        >
          {SEGMENTS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSeg(s)}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                backgroundColor: seg === s ? tokens.color.bgPrimary : 'transparent',
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: seg === s ? tokens.color.textPrimary : tokens.color.textMuted,
                }}
              >
                {LABEL[s]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 16,
        }}
      >
        {seg === 'mine' && <MineList items={mine} />}
        {seg === 'family' && <FamilyList items={scopedFeed} showBranch={isMulti && sel === 'all'} />}
        {seg === 'people' && <PeopleList memberIds={memberIds} showBranch={isMulti && sel === 'all'} />}
        {seg === 'topics' && <TopicGrid />}
      </ScrollView>
    </View>
  );
}

function MineList({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return <EmptyHint title="You haven't added anything yet." subtitle="Answer a question or ask Mom something to start your story." />;
  }
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title="May 2026" subtitle="Your answers and the questions you asked" />
      {items.map((m) => (
        <TimelineRow key={m.id} item={m} />
      ))}
    </View>
  );
}

function FamilyList({ items, showBranch }: { items: FeedItem[]; showBranch: boolean }) {
  // Group by month — fake bucketing for the demo
  const first = items.slice(0, Math.ceil(items.length / 2));
  const rest = items.slice(Math.ceil(items.length / 2));
  return (
    <View style={{ gap: 12 }}>
      {first.length > 0 && (
        <>
          <SectionHeader title="May 2026" subtitle="A flurry of food memories" />
          {first.map((m) => (
            <TimelineRow key={m.id} item={m} showBranch={showBranch} />
          ))}
        </>
      )}
      {rest.length > 0 && (
        <>
          <SectionHeader title="April 2026" subtitle="Mom's stories about Grandma" />
          {rest.map((m) => (
            <TimelineRow key={m.id} item={m} showBranch={showBranch} />
          ))}
        </>
      )}
    </View>
  );
}

function PeopleList({ memberIds, showBranch }: { memberIds: MemberId[]; showBranch: boolean }) {
  return (
    <View style={{ gap: 12 }}>
      {memberIds.map((id) => {
        const m = MEMBERS[id];
        const inBranches = Object.values(BRANCHES).filter((b) => b.memberIds.includes(id));
        return (
          <Pressable
            key={id}
            onPress={() => router.push(`/member/${id}`)}
            style={({ pressed }) => ({
              backgroundColor: tokens.color.bgPrimary,
              padding: 14,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Avatar member={m} size="lg" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
                {m.name}
              </Text>
              <Text style={{ fontSize: 14, color: tokens.color.textMuted, marginTop: 2 }}>
                {m.relationship}
                {m.age ? ` · ${m.age}` : ''}
              </Text>
              <Text style={{ fontSize: 13, color: tokens.color.accentPrimary, marginTop: 6, fontWeight: '600' }}>
                {Math.floor(Math.random() * 30) + 6} memories together
              </Text>
              {showBranch && inBranches.length > 1 && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  {inBranches.map((b) => (
                    <View
                      key={b.id}
                      style={{
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        backgroundColor: b.color + '18',
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: b.color, fontWeight: '700' }}>
                        {b.shortName}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <Text style={{ fontSize: 22, color: tokens.color.textMuted }}>›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TopicGrid() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {TOPICS.map((t) => (
        <Pressable
          key={t.slug}
          onPress={() => router.push(`/topic/${t.slug}`)}
          style={({ pressed }) => ({
            width: '47%',
            backgroundColor: tokens.color.bgPrimary,
            padding: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: tokens.color.bgTinted,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700' }}>
              {t.label[0]}
            </Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
            {t.label}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
            {t.count} memories
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ marginTop: 4 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.color.textPrimary }}>
        {title}
      </Text>
      <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2, fontStyle: 'italic' }}>
        {subtitle}
      </Text>
    </View>
  );
}

function TimelineRow({ item, showBranch }: { item: FeedItem; showBranch?: boolean }) {
  const author = MEMBERS[item.authorId];
  const branch = BRANCHES[item.branchId];
  return (
    <Pressable
      onPress={() => router.push(`/memory/${item.id}`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        gap: 12,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Avatar member={author} size="sm" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>
            {author.relationship} · {item.whenAgo}
          </Text>
          {showBranch && (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                backgroundColor: branch.color + '18',
                borderRadius: 5,
                marginLeft: 4,
              }}
            >
              <Text style={{ fontSize: 10, color: branch.color, fontWeight: '700' }}>
                {branch.shortName}
              </Text>
            </View>
          )}
        </View>
        <Text
          numberOfLines={2}
          style={{ fontSize: 15, color: tokens.color.textPrimary, marginTop: 4, lineHeight: 21 }}
        >
          {item.body}
        </Text>
        {item.topic && (
          <Text style={{ fontSize: 12, color: tokens.color.accentPrimary, marginTop: 6, fontWeight: '600' }}>
            #{item.topic.toLowerCase()}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function EmptyHint({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 18,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: tokens.color.textPrimary,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: tokens.color.textMuted,
          marginTop: 6,
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

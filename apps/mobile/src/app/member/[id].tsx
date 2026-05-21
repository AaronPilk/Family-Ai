import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { MEMBERS, MEMORIES_WITH, FEED, type MemberId, type FeedItem } from '../../lib/mockData';
import { Avatar } from '../../components/Avatar';
import { comingSoon } from '../../lib/comingSoon';

type ProfileTab = 'timeline' | 'questions' | 'vault' | 'about';

export default function MemberProfile() {
  const { id } = useLocalSearchParams<{ id: MemberId }>();
  const insets = useSafeAreaInsets();
  const memberId = (id ?? 'mom') as MemberId;
  const member = MEMBERS[memberId];
  const memCount = MEMORIES_WITH[memberId] ?? 0;
  const theirMemories = FEED.filter((f) => f.authorId === memberId);
  const [tab, setTab] = useState<ProfileTab>('timeline');

  function handleTabPress(t: ProfileTab) {
    if (t === 'timeline') {
      setTab('timeline');
    } else if (t === 'questions') {
      comingSoon('profile_tab_questions');
    } else if (t === 'vault') {
      comingSoon('profile_tab_vault');
    } else {
      comingSoon('profile_tab_about');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      {/* Header bar */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: tokens.color.bgSecondary,
        }}
      >
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
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: '700',
            color: tokens.color.textPrimary,
          }}
        >
          {member.name}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
          gap: 22,
        }}
      >
        {/* Profile card */}
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 24,
            padding: 22,
            alignItems: 'center',
            gap: 14,
            shadowColor: '#1A1418',
            shadowOpacity: 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Avatar member={member} size="xl" />
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '700',
                color: tokens.color.textPrimary,
              }}
            >
              {member.name}
            </Text>
            <Text style={{ fontSize: 15, color: tokens.color.textMuted, marginTop: 4 }}>
              {member.relationship}
              {member.age ? ` · ${member.age}` : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 24, marginTop: 6 }}>
            <Stat number={memCount} label="memories" />
            <Stat number={theirMemories.length || 12} label="answered" />
            <Stat number={3} label="vault for you" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/(tabs)/ask', params: { preselect: memberId } })
              }
              style={({ pressed }) => ({
                paddingHorizontal: 20,
                paddingVertical: 12,
                backgroundColor: tokens.color.accentPrimary,
                borderRadius: 999,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Ask {member.name} something</Text>
            </Pressable>
            <Pressable
              onPress={() => comingSoon('view_vault_for_me')}
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: tokens.color.bgTinted,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 18 }}>🔒</Text>
            </Pressable>
          </View>
        </View>

        {/* Tab strip — for demo just labels, no behavior */}
        <View
          style={{
            flexDirection: 'row',
            gap: 24,
            paddingHorizontal: 4,
            borderBottomWidth: 1,
            borderBottomColor: tokens.color.borderSubtle,
          }}
        >
          {[
            { id: 'timeline' as const, label: 'Timeline' },
            { id: 'questions' as const, label: 'Questions' },
            { id: 'vault' as const, label: 'Vault for me' },
            { id: 'about' as const, label: 'About' },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => handleTabPress(t.id)}
                style={{ paddingVertical: 10 }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: active ? '700' : '500',
                    color: active ? tokens.color.accentPrimary : tokens.color.textMuted,
                  }}
                >
                  {t.label}
                </Text>
                {active && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      left: 0,
                      right: 0,
                      height: 2,
                      backgroundColor: tokens.color.accentPrimary,
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* The story of you & them — AI summary card */}
        <View
          style={{
            padding: 16,
            backgroundColor: tokens.color.bgTinted,
            borderRadius: 16,
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: tokens.color.accentPrimary,
              fontWeight: '700',
              letterSpacing: 1,
            }}
          >
            STORY SO FAR · WRITTEN BY KIN
          </Text>
          <Text style={{ fontSize: 15, color: tokens.color.textPrimary, lineHeight: 22 }}>
            You've asked {member.name} {Math.max(memCount - 12, 8)} questions this year. Most have
            been about food, childhood, and what it was like raising you. Their voice notes average
            47 seconds and there are 4 photos you've never seen before.
          </Text>
          <Pressable
            onPress={() => comingSoon('generate_book')}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              marginTop: 4,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 13 }}>
              Generate a book of {member.name}'s answers →
            </Text>
          </Pressable>
        </View>

        {/* Section headers + memories */}
        <SectionHeader title="May 2026" subtitle="A flurry of food memories" />
        {(theirMemories.length > 0 ? theirMemories : sampleFor(memberId)).map((m) => (
          <MemoryCard key={m.id} item={m} memberName={member.name} />
        ))}

        <SectionHeader
          title="April 2026"
          subtitle={`${member.relationship} on family traditions`}
        />
        {sampleFor(memberId).map((m) => (
          <MemoryCard key={`p2-${m.id}`} item={m} memberName={member.name} />
        ))}
      </ScrollView>
    </View>
  );
}

function Stat({ number, label }: { number: number; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color: tokens.color.textPrimary,
        }}
      >
        {number}
      </Text>
      <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ marginTop: 4 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.color.textPrimary }}>
        {title}
      </Text>
      <Text
        style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2, fontStyle: 'italic' }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function MemoryCard({ item, memberName }: { item: FeedItem; memberName: string }) {
  // Sample/synthetic memories have id prefix "sample-" — they don't exist in FEED
  const isSynthetic = item.id.startsWith('sample-');
  return (
    <Pressable
      onPress={() => (isSynthetic ? comingSoon('open_memory') : router.push(`/memory/${item.id}`))}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>
        {item.whenAgo}
        {item.relatedToName ? ` · answered ${item.relatedToName}` : ''}
      </Text>
      <Text
        style={{
          marginTop: 8,
          fontSize: 16,
          lineHeight: 24,
          color: tokens.color.textPrimary,
        }}
      >
        {item.body}
      </Text>
      {(item.mediaKind === 'voice' || item.mediaKind === 'video') && (
        <View
          style={{
            marginTop: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: tokens.color.bgTinted,
            borderRadius: 12,
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
            {item.mediaKind === 'video' ? 'Video' : 'Voice'} ·{' '}
            {Math.floor((item.durationSec ?? 60) / 60)}:
            {String((item.durationSec ?? 60) % 60).padStart(2, '0')}
          </Text>
        </View>
      )}
      {item.mediaKind === 'photo' && (
        <View
          style={{
            marginTop: 12,
            height: 140,
            borderRadius: 12,
            backgroundColor: item.photoTint ?? tokens.color.bgTinted,
          }}
        />
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {item.appearsIn.map((t) => (
          <View
            key={t}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
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

// Fallback samples for members who don't have feed items yet
function sampleFor(id: MemberId): FeedItem[] {
  const m = MEMBERS[id];
  const baseAppears = [`${m.name}'s timeline`, `You ↔ ${m.name}`];
  return [
    {
      id: `sample-${id}-1`,
      branchId: 'pilks',
      authorId: id,
      kind: 'answer',
      body: 'I remember the day you were born like it was yesterday. The light through the window was strange — almost gold. I knew immediately you were going to be okay.',
      mediaKind: 'voice',
      durationSec: 73,
      relatedToName: 'Aaron',
      visibility: 'just_us',
      topic: 'Love',
      reactions: 4,
      comments: 1,
      whenAgo: '2 weeks ago',
      appearsIn: [...baseAppears, 'Love'],
    },
    {
      id: `sample-${id}-2`,
      branchId: 'pilks',
      authorId: id,
      kind: 'answer',
      body: 'Every Christmas Eve we made pierogis from scratch. Your grandmother would put me on the rolling pin. I hated it then. I miss it now.',
      mediaKind: 'text',
      relatedToName: 'Aaron',
      visibility: 'just_us',
      topic: 'Holidays',
      reactions: 2,
      comments: 0,
      whenAgo: '3 weeks ago',
      appearsIn: [...baseAppears, 'Holidays', 'Family traditions'],
    },
  ];
}

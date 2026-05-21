import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { FEED, MEMBERS, BRANCHES, VISIBILITY_LABEL } from '../../lib/mockData';
import { Avatar } from '../../components/Avatar';
import { comingSoon } from '../../lib/comingSoon';

export default function MemoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const memory = FEED.find((f) => f.id === id);

  if (!memory) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
        <BackHeader insets={insets} title="" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: tokens.color.textMuted, fontSize: 16 }}>Memory not found.</Text>
        </View>
      </View>
    );
  }

  const author = MEMBERS[memory.authorId];
  const branch = BRANCHES[memory.branchId];

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <BackHeader insets={insets} title="Memory" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 20 }}>
        {/* Question banner (when this is an answer) */}
        {memory.kind === 'answer' && memory.relatedToName && (
          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              marginHorizontal: 20,
              padding: 14,
              borderRadius: 14,
              gap: 6,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: tokens.color.accentPrimary,
                letterSpacing: 1,
              }}
            >
              ANSWERED A QUESTION FROM {memory.relatedToName.toUpperCase()}
            </Text>
            <Text style={{ fontSize: 14, color: tokens.color.textSecondary, fontStyle: 'italic' }}>
              {topicQuestionFor(memory.topic ?? '')}
            </Text>
          </View>
        )}

        {/* Author */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 }}>
          <Pressable onPress={() => router.push(`/member/${memory.authorId}`)}>
            <Avatar member={author} size="lg" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
              {author.name}
            </Text>
            <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
              {author.relationship} · {memory.whenAgo}
            </Text>
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
              {VISIBILITY_LABEL[memory.visibility]}
            </Text>
          </View>
        </View>

        {/* Body */}
        {memory.body && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text
              style={{
                fontSize: 19,
                lineHeight: 28,
                color: tokens.color.textPrimary,
              }}
            >
              {memory.body}
            </Text>
          </View>
        )}

        {/* Media */}
        {memory.mediaKind === 'photo' && (
          <View
            style={{
              marginHorizontal: 20,
              height: 280,
              borderRadius: 18,
              backgroundColor: memory.photoTint ?? tokens.color.bgTinted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: tokens.color.textMuted, fontSize: 13 }}>photo</Text>
          </View>
        )}
        {(memory.mediaKind === 'voice' || memory.mediaKind === 'video') && (
          <View
            style={{
              marginHorizontal: 20,
              padding: 16,
              borderRadius: 18,
              backgroundColor: tokens.color.bgTinted,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={() => comingSoon(memory.mediaKind === 'voice' ? 'record_voice' : 'record_video')}
                style={({ pressed }) => ({
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: tokens.color.accentPrimary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: 'white', fontSize: 22 }}>▶</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.color.textPrimary }}>
                  {memory.mediaKind === 'voice' ? 'Voice memory' : 'Video memory'}
                </Text>
                <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
                  {Math.floor((memory.durationSec ?? 0) / 60)}:{String((memory.durationSec ?? 0) % 60).padStart(2, '0')}
                </Text>
              </View>
            </View>
            {/* Transcript */}
            <View
              style={{
                padding: 12,
                backgroundColor: 'white',
                borderRadius: 12,
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: tokens.color.textMuted,
                  letterSpacing: 1,
                }}
              >
                AUTO-TRANSCRIBED
              </Text>
              <Text style={{ fontSize: 14, color: tokens.color.textPrimary, lineHeight: 20 }}>
                {memory.body ?? '…'}
              </Text>
            </View>
          </View>
        )}

        {/* Appears in */}
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: tokens.color.textSecondary }}>
            APPEARS IN
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {memory.appearsIn.map((t) => (
              <View
                key={t}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  backgroundColor: tokens.color.bgTinted,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 12, color: tokens.color.accentPrimary, fontWeight: '600' }}>
                  {t}
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, lineHeight: 18 }}>
            One memory, multiple homes. This is how your family archive stays organized.
          </Text>
        </View>

        {/* Reactions row */}
        <View
          style={{
            marginHorizontal: 20,
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            backgroundColor: tokens.color.bgPrimary,
            flexDirection: 'row',
            gap: 18,
            alignItems: 'center',
          }}
        >
          <FooterAction icon="♡" label={`${memory.reactions}`} onPress={() => comingSoon('react_or_comment')} />
          <FooterAction icon="💬" label={`${memory.comments}`} onPress={() => comingSoon('react_or_comment')} />
          <Pressable
            onPress={() => comingSoon('react_or_comment')}
            style={({ pressed }) => ({
              marginLeft: 'auto',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: tokens.color.accentPrimary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Add reply</Text>
          </Pressable>
        </View>

        {/* Branch chip */}
        <View
          style={{ flexDirection: 'row', paddingHorizontal: 20, alignItems: 'center', gap: 8 }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: branch.color,
            }}
          />
          <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>
            In {branch.shortName} · {memory.topic ?? 'No topic'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function BackHeader({ insets, title }: { insets: { top: number }; title: string }) {
  return (
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
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 16,
          fontWeight: '700',
          color: tokens.color.textPrimary,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function FooterAction({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 18, color: tokens.color.textSecondary }}>{icon}</Text>
        <Text style={{ fontSize: 14, color: tokens.color.textSecondary }}>{label}</Text>
      </View>
    </Pressable>
  );
}

function topicQuestionFor(topic: string): string {
  switch (topic) {
    case 'Food': return 'What did you eat with Chicken in a Biskit crackers as a kid?';
    case 'Love': return 'What did you think the first time you held me?';
    case 'Music': return 'What music were you listening to at my age?';
    case 'Childhood': return 'What is your earliest memory?';
    case 'Holidays': return 'What was your favorite holiday growing up?';
    case 'Recipes': return 'Is there a recipe you want me to remember?';
    default: return 'A question from your family.';
  }
}

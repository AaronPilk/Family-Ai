import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  FEED,
  INBOX,
  TODAY_PROMPTS,
  MEMBERS,
  PHOTO_BOOKS,
  momentsForBranches,
  type FeedItem,
  type FamilyMoment,
} from '../../lib/mockData';
import { useCurrentBranch, useScopedBranchIds, useSelection } from '../../lib/branchStore';
import { Avatar } from '../../components/Avatar';
import { BranchSwitcher } from '../../components/BranchSwitcher';
import { comingSoon } from '../../lib/comingSoon';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const branch = useCurrentBranch();
  const sel = useSelection();
  const scopedIds = useScopedBranchIds();
  // For the daily prompt, pick the first branch in scope (or default Pilks for 'all')
  const today = TODAY_PROMPTS[scopedIds[0] ?? 'pilks'];
  const inbox = INBOX.filter((q) => scopedIds.includes(q.branchId));
  const feed = FEED.filter((f) => scopedIds.includes(f.branchId));
  const moments = momentsForBranches(scopedIds);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 120,
        }}
      >
        {/* Top branding + branch switcher */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <BranchSwitcher />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginTop: 10,
            }}
          >
            <View>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: tokens.color.textPrimary,
                }}
              >
                Today
              </Text>
              <Text style={{ fontSize: 14, color: tokens.color.textMuted, marginTop: 2 }}>
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton glyph="🔍" onPress={() => router.push('/search')} />
              <IconButton glyph="🔔" onPress={() => router.push('/notifications')} />
            </View>
          </View>
        </View>

        {/* TODAY prompt — the hero */}
        <View style={{ paddingHorizontal: 20 }}>
          <View
            style={{
              backgroundColor: tokens.color.accentPrimary,
              borderRadius: 24,
              padding: 22,
              shadowColor: tokens.color.accentPrimary,
              shadowOpacity: 0.25,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <Text
              style={{
                color: '#FFD8E0',
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 1.5,
              }}
            >
              YOUR PROMPT TODAY
            </Text>
            <Text
              style={{
                color: 'white',
                fontSize: 22,
                fontWeight: '700',
                lineHeight: 30,
                marginTop: 10,
              }}
            >
              {today.prompt}
            </Text>
            <View
              style={{
                marginTop: 18,
                flexDirection: 'row',
                gap: 8,
              }}
            >
              <PromptAction label="🎤  Voice" primary onPress={() => comingSoon('record_voice')} />
              <PromptAction label="✍️  Type" onPress={() => comingSoon('today_prompt')} />
              <PromptAction label="↷ Skip" onPress={() => comingSoon('skip_prompt')} />
            </View>
            <Text style={{ marginTop: 16, color: '#FFD8E0', fontSize: 13 }}>
              When you answer, it lives in three places: your timeline, the family book, and the
              relationship story of whoever you're talking to.
            </Text>
          </View>
        </View>

        {/* MOMENTS — events being planned */}
        {moments.length > 0 && (
          <Section title="Family moments — being planned">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingRight: 8 }}
            >
              {moments.map((m) => (
                <MomentCard key={m.id} moment={m} />
              ))}
            </ScrollView>
            <Pressable
              onPress={() => router.push('/new/moment')}
              style={({ pressed }) => ({
                marginTop: 4,
                paddingHorizontal: 16,
                paddingVertical: 10,
                alignSelf: 'flex-start',
                backgroundColor: tokens.color.bgTinted,
                borderRadius: 999,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: tokens.color.accentPrimary, fontWeight: '600', fontSize: 13 }}>
                + Plan a new moment
              </Text>
            </Pressable>
          </Section>
        )}

        {/* INBOX */}
        {inbox.length > 0 && (
          <Section
            title={`People asked you ${inbox.length} ${inbox.length === 1 ? 'question' : 'questions'}`}
          >
            <View style={{ gap: 10 }}>
              {inbox.map((q) => {
                const from = MEMBERS[q.fromId];
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => router.push(`/answer/${q.id}`)}
                    style={({ pressed }) => ({
                      backgroundColor: tokens.color.bgPrimary,
                      padding: 14,
                      borderRadius: 16,
                      flexDirection: 'row',
                      gap: 12,
                      borderWidth: 1,
                      borderColor: tokens.color.borderSubtle,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Avatar member={from} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 13, color: tokens.color.textMuted, marginBottom: 4 }}
                      >
                        {from.relationship} · {q.whenAgo}
                      </Text>
                      <Text
                        style={{
                          fontSize: 15,
                          color: tokens.color.textPrimary,
                          lineHeight: 21,
                        }}
                      >
                        {q.body}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: tokens.color.accentPrimary,
                          fontWeight: '700',
                          marginTop: 8,
                        }}
                      >
                        Answer →
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        )}

        {/* Photo Books CTA */}
        <Section title="Bring the old albums in">
          <Pressable
            onPress={() => comingSoon('photo_book')}
            style={({ pressed }) => ({
              backgroundColor: '#F2EFEA',
              padding: 18,
              borderRadius: 18,
              opacity: pressed ? 0.8 : 1,
              borderWidth: 1,
              borderColor: '#E5DCD2',
            })}
          >
            <Text
              style={{
                color: '#8C6A3F',
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 1.2,
              }}
            >
              PHOTO BOOK CAPTURE
            </Text>
            <Text
              style={{
                color: tokens.color.textPrimary,
                fontSize: 17,
                fontWeight: '700',
                marginTop: 6,
              }}
            >
              Digitize an album one page at a time
            </Text>
            <Text
              style={{
                color: tokens.color.textSecondary,
                fontSize: 14,
                marginTop: 4,
                lineHeight: 20,
              }}
            >
              Point your phone at each page. Kin extracts every photo, dates them, and asks who's in
              them — so your binder lives forever.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              {PHOTO_BOOKS.map((b) => (
                <View
                  key={b.id}
                  style={{
                    flex: 1,
                    padding: 10,
                    backgroundColor: 'white',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E5DCD2',
                  }}
                >
                  <View
                    style={{
                      height: 60,
                      borderRadius: 8,
                      backgroundColor: b.coverTint,
                      marginBottom: 8,
                    }}
                  />
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 13, fontWeight: '700', color: tokens.color.textPrimary }}
                  >
                    {b.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: tokens.color.textMuted,
                      marginTop: 2,
                    }}
                  >
                    {b.pageCount} pages · {b.status === 'ready' ? 'Ready' : 'Processing'}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Section>

        {/* Recent activity strip */}
        <Section title="Recent in this branch">
          <View style={{ gap: 12 }}>
            {feed.slice(0, 4).map((item) => (
              <RecentRow key={item.id} item={item} />
            ))}
          </View>
          <Pressable
            onPress={() => router.push('/feed')}
            style={({ pressed }) => ({
              marginTop: 12,
              padding: 14,
              alignItems: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={{ color: tokens.color.accentPrimary, fontWeight: '600' }}>
              See the whole feed →
            </Text>
          </Pressable>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 20, marginTop: 28, gap: 12 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.textSecondary }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function RecentRow({ item }: { item: FeedItem }) {
  const author = MEMBERS[item.authorId];
  return (
    <Pressable
      onPress={() => router.push(`/member/${item.authorId}`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        padding: 14,
        borderRadius: 14,
        flexDirection: 'row',
        gap: 12,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Avatar member={author} size="sm" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.color.textPrimary }}>
            {author.name}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>
            · {author.relationship} · {item.whenAgo}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={{ fontSize: 14, color: tokens.color.textPrimary, marginTop: 4, lineHeight: 20 }}
        >
          {item.body}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
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
      </View>
    </Pressable>
  );
}

function PromptAction({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 44,
        borderRadius: 12,
        backgroundColor: primary ? 'white' : 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: primary ? tokens.color.accentPrimary : 'white',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MomentCard({ moment }: { moment: FamilyMoment }) {
  const statusLabel = {
    planning: { label: 'PLANNING', color: tokens.color.accentPrimary },
    upcoming: { label: 'UPCOMING', color: '#286B43' },
    happening: { label: 'HAPPENING', color: '#B9701D' },
    past: { label: 'PAST', color: tokens.color.textMuted },
  }[moment.status];

  const participantAvatars = moment.participantIds.slice(0, 4).map((id) => MEMBERS[id]);

  return (
    <Pressable
      onPress={() => router.push(`/moment/${moment.id}`)}
      style={({ pressed }) => ({
        width: 280,
        borderRadius: 20,
        backgroundColor: tokens.color.bgPrimary,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* Hero */}
      <View
        style={{
          height: 96,
          backgroundColor: moment.coverTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 40 }}>{moment.coverGlyph}</Text>
      </View>
      {/* Body */}
      <View style={{ padding: 14, gap: 8 }}>
        <Text
          style={{ fontSize: 11, fontWeight: '700', color: statusLabel.color, letterSpacing: 1 }}
        >
          {statusLabel.label}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
          {moment.title}
        </Text>
        <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>{moment.dateRangeText}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <View style={{ flexDirection: 'row' }}>
            {participantAvatars.map((m, i) => (
              <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Avatar member={m} size="sm" />
              </View>
            ))}
          </View>
          <Text style={{ marginLeft: 10, fontSize: 12, color: tokens.color.textMuted }}>
            {moment.participantIds.length} people
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function IconButton({ glyph, onPress }: { glyph: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
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
      <Text style={{ fontSize: 16 }}>{glyph}</Text>
    </Pressable>
  );
}

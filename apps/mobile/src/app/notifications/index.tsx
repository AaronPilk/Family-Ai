import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { MEMBERS, type MemberId } from '../../lib/mockData';
import { Avatar } from '../../components/Avatar';

interface Notif {
  id: string;
  kind: 'question_received' | 'answer_received' | 'vault_releasing' | 'digest' | 'moment_update';
  fromId?: MemberId;
  body: string;
  whenAgo: string;
  unread?: boolean;
  goTo?: string;
}

const NOTIFS: Notif[] = [
  {
    id: 'n1',
    kind: 'question_received',
    fromId: 'mom',
    body: 'Linda asked you a memory question.',
    whenAgo: '1h ago',
    unread: true,
    goTo: '/answer/q1',
  },
  {
    id: 'n2',
    kind: 'answer_received',
    fromId: 'grace',
    body: 'Grandma answered your question about holding you.',
    whenAgo: '3h ago',
    unread: true,
    goTo: '/memory/3',
  },
  {
    id: 'n3',
    kind: 'vault_releasing',
    body: 'A vault item is ready to release: "For Mike on his 50th" (in 12 years).',
    whenAgo: 'yesterday',
  },
  {
    id: 'n4',
    kind: 'moment_update',
    fromId: 'mom',
    body: 'Mom voted on Tahoe family week dates.',
    whenAgo: 'yesterday',
    goTo: '/moment/tahoe',
  },
  {
    id: 'n5',
    kind: 'answer_received',
    fromId: 'dad',
    body: 'Tom answered your question about music.',
    whenAgo: '1w ago',
    goTo: '/memory/5',
  },
  {
    id: 'n6',
    kind: 'digest',
    body: 'Your family added 4 memories this week. Take a look.',
    whenAgo: '1w ago',
    goTo: '/feed',
  },
];

const ICON: Record<Notif['kind'], string> = {
  question_received: '❓',
  answer_received: '✨',
  vault_releasing: '🔒',
  digest: '📰',
  moment_update: '🗓',
};

export default function Notifications() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: tokens.color.bgSecondary,
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
            Notifications
          </Text>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 1 }}>
            {NOTIFS.filter((n) => n.unread).length} unread
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
          gap: 8,
        }}
      >
        {NOTIFS.map((n) => {
          const from = n.fromId ? MEMBERS[n.fromId] : null;
          return (
            <Pressable
              key={n.id}
              onPress={() => n.goTo && router.push(n.goTo as any)}
              style={({ pressed }) => ({
                padding: 14,
                backgroundColor: n.unread ? tokens.color.bgTinted : tokens.color.bgPrimary,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: n.unread
                  ? tokens.color.accentPrimary + '40'
                  : tokens.color.borderSubtle,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {from ? (
                <Avatar member={from} size="md" />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: tokens.color.bgPrimary,
                    borderWidth: 1,
                    borderColor: tokens.color.borderSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{ICON[n.kind]}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: tokens.color.textPrimary,
                    lineHeight: 20,
                    fontWeight: n.unread ? '600' : '400',
                  }}
                >
                  {n.body}
                </Text>
                <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 4 }}>
                  {n.whenAgo}
                </Text>
              </View>
              {n.unread && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: tokens.color.accentPrimary,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

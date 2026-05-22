import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { MEMBERS, type MemberId } from '../../lib/mockData';
import { Avatar } from '../../components/Avatar';
import { DemoModeBanner } from '../../components/DemoModeBanner';
import { useHasFamily } from '../../lib/useHasFamily';
import { DEMO_NOTIFICATIONS, DEMO_PEOPLE_LIST } from '../../lib/demoData';

interface Notif {
  id: string;
  kind: 'question_received' | 'answer_received' | 'vault_releasing' | 'digest' | 'moment_update';
  fromId?: MemberId;
  body: string;
  whenAgo: string;
  unread?: boolean;
  goTo?: string;
}

const ICON: Record<Notif['kind'], string> = {
  question_received: '❓',
  answer_received: '✨',
  vault_releasing: '🔒',
  digest: '📰',
  moment_update: '🗓',
};

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const { hasFamily } = useHasFamily();

  // When the user has no family, show the warm demo notification list under a
  // sticky DEMO banner. When they have family, real notifications (none yet —
  // this screen is still pre-supabase for notifications) would show here.
  const items: Notif[] = hasFamily
    ? []
    : DEMO_NOTIFICATIONS.map((n) => {
        const person = n.fromId
          ? DEMO_PEOPLE_LIST.find((p) => p.id === n.fromId)
          : undefined;
        return {
          id: n.id,
          kind: n.kind,
          fromId: undefined,
          body: n.body,
          whenAgo: n.whenAgo,
          unread: n.unread,
          // Inline demo display fields, consumed below.
          _demoFromName: person?.name,
          _demoFromInitials: person?.initials,
          _demoFromColor: person?.color,
          _demoFromRel: person?.relationship,
        } as Notif & {
          _demoFromName?: string;
          _demoFromInitials?: string;
          _demoFromColor?: string;
          _demoFromRel?: string;
        };
      });

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
            {items.filter((n) => n.unread).length} unread
          </Text>
        </View>
      </View>

      {!hasFamily && <DemoModeBanner />}

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
          gap: 8,
        }}
      >
        {items.length === 0 && (
          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              padding: 24,
              borderRadius: 18,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
              No notifications yet
            </Text>
            <Text style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 19 }}>
              When your family asks you a question, answers one, or RSVPs to an event, you'll see
              it here.
            </Text>
          </View>
        )}
        {items.map((n) => {
          const demoN = n as Notif & {
            _demoFromName?: string;
            _demoFromInitials?: string;
            _demoFromColor?: string;
            _demoFromRel?: string;
          };
          const from = n.fromId
            ? MEMBERS[n.fromId]
            : demoN._demoFromName
              ? {
                  id: 'me' as MemberId,
                  name: demoN._demoFromName,
                  relationship: demoN._demoFromRel ?? '',
                  initials: demoN._demoFromInitials ?? '?',
                  color: demoN._demoFromColor ?? tokens.color.accentPrimary,
                }
              : null;
          return (
            <Pressable
              key={n.id}
              onPress={() => n.goTo && router.push(n.goTo as never)}
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

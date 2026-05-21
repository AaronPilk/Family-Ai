import { useLocalSearchParams, router } from 'expo-router';
import { Alert, ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { MEMBERS } from '../../lib/mockData';
import { useVaultStore } from '../../lib/vaultStore';
import { Avatar } from '../../components/Avatar';
import { comingSoon } from '../../lib/comingSoon';

const STATUS_TONE = {
  sealed:    { bg: '#FFF1E0', fg: '#A56627', label: 'Sealed' },
  scheduled: { bg: '#E1F1E7', fg: '#286B43', label: 'Scheduled' },
  released:  { bg: '#FFE3EA', fg: '#9B294A', label: 'Released' },
  revoked:   { bg: '#F1E7EA', fg: '#5C545A', label: 'Revoked' },
  awaiting_verification: { bg: '#FFF1E0', fg: '#A56627', label: 'Awaiting verification' },
} as const;

export default function VaultDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const item = useVaultStore((s) => s.items.find((v) => v.id === id));
  const removeItem = useVaultStore((s) => s.removeItem);

  if (!item) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: tokens.color.textMuted }}>Vault item not found.</Text>
      </View>
    );
  }

  const tone = STATUS_TONE[item.status];
  const recipients = item.recipientIds.map((rid) => MEMBERS[rid]);

  function confirmRevoke() {
    Alert.alert(
      'Revoke this vault item?',
      'It won\'t be released and the recipients will never see it. You can\'t undo this.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => {
            removeItem(item!.id);
            router.back();
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
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
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
            Vault item
          </Text>
        </View>

        {/* Hero card */}
        <View
          style={{
            margin: 20,
            padding: 24,
            backgroundColor: tokens.color.bgVault,
            borderRadius: 24,
            gap: 16,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: item.mediaKind === 'money' ? '#1F3D2A' : 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 28,
                color: item.mediaKind === 'money' ? '#9EE0B5' : 'white',
              }}
            >
              {item.mediaKind === 'video'
                ? '🎥'
                : item.mediaKind === 'voice'
                  ? '🎤'
                  : item.mediaKind === 'money'
                    ? '$'
                    : '✉'}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#C09155',
                letterSpacing: 1.2,
              }}
            >
              {item.mediaKind === 'money' ? 'MONEY RELEASE' : 'PRIVATE VAULT ITEM'}
            </Text>
            <Text style={{ fontSize: 24, fontWeight: '700', color: 'white', lineHeight: 30 }}>
              {item.title}
              {item.mediaKind === 'money' && item.amountUsd
                ? ` · $${item.amountUsd.toLocaleString()}`
                : ''}
            </Text>
            <Text style={{ fontSize: 14, color: '#D8C7CC', lineHeight: 20 }}>
              {item.releaseText}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: tone.bg,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: tone.fg, fontSize: 12, fontWeight: '700' }}>{tone.label}</Text>
            </View>
            {item.durationSec && (
              <Text style={{ fontSize: 12, color: '#D8C7CC' }}>
                {Math.floor(item.durationSec / 60)}:
                {String(item.durationSec % 60).padStart(2, '0')}
              </Text>
            )}
          </View>
        </View>

        {/* Recipients */}
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
            FOR
          </Text>
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row' }}>
              {recipients.map((r, i) => (
                <View key={r.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                  <Avatar member={r} size="md" />
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 14, color: tokens.color.textPrimary, fontWeight: '600' }}>
              {recipients.map((r) => (r.id === 'me' ? 'You' : r.name)).join(', ')}
            </Text>
          </View>
        </View>

        {/* Media preview */}
        {(item.mediaKind === 'voice' || item.mediaKind === 'video') && (
          <View
            style={{
              marginHorizontal: 20,
              marginTop: 16,
              padding: 16,
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Pressable
              onPress={() => comingSoon(item.mediaKind === 'voice' ? 'record_voice' : 'record_video')}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: tokens.color.accentPrimary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: 'white', fontSize: 22 }}>▶</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.color.textPrimary }}>
                Preview (creator only)
              </Text>
              <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
                Only you can hear this until it releases.
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={{ padding: 20, gap: 10 }}>
          <Pressable
            onPress={() => comingSoon('new_vault')}
            style={({ pressed }) => ({
              padding: 14,
              borderRadius: 14,
              backgroundColor: tokens.color.bgPrimary,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ flex: 1, fontSize: 15, color: tokens.color.textPrimary }}>
              Edit release rule
            </Text>
            <Text style={{ color: tokens.color.textMuted, fontSize: 20 }}>›</Text>
          </Pressable>
          <Pressable
            onPress={() => comingSoon('new_vault')}
            style={({ pressed }) => ({
              padding: 14,
              borderRadius: 14,
              backgroundColor: tokens.color.bgPrimary,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ flex: 1, fontSize: 15, color: tokens.color.textPrimary }}>
              Change recipients
            </Text>
            <Text style={{ color: tokens.color.textMuted, fontSize: 20 }}>›</Text>
          </Pressable>
          <Pressable
            onPress={confirmRevoke}
            style={({ pressed }) => ({
              padding: 14,
              borderRadius: 14,
              backgroundColor: tokens.color.bgPrimary,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ flex: 1, fontSize: 15, color: tokens.color.danger, fontWeight: '600' }}>
              Revoke this vault item
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

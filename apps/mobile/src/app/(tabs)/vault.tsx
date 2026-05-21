import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { MEMBERS, type VaultItem } from '../../lib/mockData';
import { useVaultStore } from '../../lib/vaultStore';
import { Avatar } from '../../components/Avatar';

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'mine' | 'for_me'>('mine');
  const items = useVaultStore((s) => s.items);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 20,
        }}
      >
        {/* Header */}
        <View>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: '#A56627',
              letterSpacing: 1.5,
            }}
          >
            PRIVATE
          </Text>
          <Text style={{ fontSize: 28, fontWeight: '700', color: tokens.color.textPrimary }}>
            Vault
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: tokens.color.textSecondary,
              marginTop: 4,
              lineHeight: 22,
            }}
          >
            Leave a message for the future. Choose when it should arrive.
          </Text>
        </View>

        {/* Segmented control */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: tokens.color.bgTinted,
            borderRadius: 12,
            padding: 4,
          }}
        >
          {(['mine', 'for_me'] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                backgroundColor: tab === id ? tokens.color.bgPrimary : 'transparent',
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: tab === id ? tokens.color.textPrimary : tokens.color.textMuted,
                }}
              >
                {id === 'mine' ? 'My vault' : 'For me'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* New vault item CTA */}
        <Pressable
          onPress={() => router.push('/new/vault')}
          style={({ pressed }) => ({
            backgroundColor: tokens.color.bgVault,
            padding: 18,
            borderRadius: 18,
            opacity: pressed ? 0.85 : 1,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
          })}
        >
          <Text style={{ fontSize: 13, color: '#C09155', fontWeight: '700', letterSpacing: 1.2 }}>
            NEW VAULT ITEM
          </Text>
          <Text style={{ fontSize: 18, color: 'white', fontWeight: '700', marginTop: 4 }}>
            Record something for later
          </Text>
          <Text style={{ fontSize: 14, color: '#D8C7CC', marginTop: 4, lineHeight: 20 }}>
            A video for Sara's wedding day. A college fund that unlocks on graduation. Words for
            when you can't be there.
          </Text>
        </Pressable>

        {/* List */}
        <View style={{ gap: 12 }}>
          {tab === 'mine' && items.map((v) => <VaultCard key={v.id} item={v} />)}
          {tab === 'for_me' && (
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
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: tokens.color.bgTinted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 24 }}>🔒</Text>
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: tokens.color.textPrimary,
                  textAlign: 'center',
                }}
              >
                Nothing has been released to you yet.
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
                When someone in your family records a vault message for you and it's time, it'll
                appear here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function VaultCard({ item }: { item: VaultItem }) {
  const recipients = item.recipientIds.map((id) => MEMBERS[id]);
  const statusTone = {
    sealed: { bg: '#FFF1E0', fg: '#A56627', label: 'Sealed' },
    scheduled: { bg: '#E1F1E7', fg: '#286B43', label: 'Scheduled' },
    released: { bg: '#FFE3EA', fg: '#9B294A', label: 'Released' },
  }[item.status] ?? { bg: '#F1E7EA', fg: '#5C545A', label: item.status };

  return (
    <Pressable
      onPress={() => router.push(`/vault/${item.id}`)}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: item.mediaKind === 'money' ? '#1F3D2A' : tokens.color.bgVault,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 18, color: item.mediaKind === 'money' ? '#9EE0B5' : undefined }}>
            {item.mediaKind === 'video'
              ? '🎥'
              : item.mediaKind === 'voice'
                ? '🎤'
                : item.mediaKind === 'money'
                  ? '$'
                  : '✉'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
            {item.mediaKind === 'money' && item.amountUsd
              ? `${item.title} · $${item.amountUsd.toLocaleString()}`
              : item.title}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
            {item.releaseText}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: tokens.color.borderSubtle,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          {recipients.map((r, i) => (
            <View key={r.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
              <Avatar member={r} size="sm" />
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 13, color: tokens.color.textSecondary }}>
          For {recipients.map((r) => (r.relationship === 'You' ? 'you' : r.name)).join(', ')}
        </Text>
        <View style={{ marginLeft: 'auto' }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              backgroundColor: statusTone.bg,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: statusTone.fg, fontSize: 12, fontWeight: '700' }}>
              {statusTone.label}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

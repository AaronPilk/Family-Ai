/**
 * vault/[id] — single proof-of-life entry detail.
 *
 * Author-only by RLS: the recipient view is a chronological wall, not this
 * detail screen. So this screen always reads from the author's perspective
 * and shows the immutable server timestamp + full body.
 */
import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { getVaultItem, type VaultEntry } from '../../lib/supabaseVault';
import { fetchMediaAsset, getPublicUrl, type MediaAsset } from '../../lib/mediaUpload';
import { VaultTrustBadge, formatVaultTimestamp } from '../../components/VaultTrustBadge';

export default function VaultDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState<VaultEntry | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaAsset | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const e = await getVaultItem(id);
        setEntry(e);
        if (e?.mediaAssetId) {
          const m = await fetchMediaAsset(e.mediaAssetId);
          setMedia(m);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load entry.');
        setEntry(null);
      }
    })();
  }, [id]);

  if (entry === undefined) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.color.bgSecondary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={tokens.color.accentPrimary} />
      </View>
    );
  }

  if (!entry) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.color.bgSecondary,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text style={{ color: tokens.color.textMuted, textAlign: 'center', marginBottom: 12 }}>
          {error ?? 'Vault entry not found.'}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: tokens.color.accentPrimary, fontWeight: '600' }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
          gap: 18,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 22, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: tokens.color.accentGold,
                letterSpacing: 1.5,
              }}
            >
              VAULT ENTRY
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.color.textPrimary }}>
              {formatVaultTimestamp(entry.createdAt)}
            </Text>
          </View>
        </View>

        {/* Body */}
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            gap: 14,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: tokens.color.textMuted,
              fontWeight: '700',
              letterSpacing: 1.2,
            }}
          >
            STAMPED {new Date(entry.createdAt).toISOString()}
          </Text>
          {media && (
            <Image
              source={{ uri: getPublicUrl(media) }}
              style={{
                width: '100%',
                aspectRatio:
                  media.width && media.height ? media.width / media.height : 4 / 3,
                borderRadius: 12,
                backgroundColor: tokens.color.bgTinted,
              }}
              resizeMode="cover"
            />
          )}
          <Text style={{ fontSize: 16, color: tokens.color.textPrimary, lineHeight: 24 }}>
            {entry.body}
          </Text>
          <VaultTrustBadge />
        </View>

        <Text
          style={{
            fontSize: 12,
            color: tokens.color.textMuted,
            textAlign: 'center',
            lineHeight: 18,
          }}
        >
          This entry can't be edited or deleted. That's the point — the trail is honest.
        </Text>
      </ScrollView>
    </View>
  );
}

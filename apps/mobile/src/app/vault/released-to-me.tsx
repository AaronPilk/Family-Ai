/**
 * vault/released-to-me — the recipient experience.
 *
 * Chronological wall of vault entries from authors who have released their
 * trail to the current user. Oldest at top, scroll down for newer. Calm,
 * slow, no reactions, no replies. This is for reading.
 *
 * If multiple authors have released to me, each gets its own grouped section.
 */
import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  View,
  Text,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { listReleasedToMe, type VaultEntry, type VaultRelease } from '../../lib/supabaseVault';
import { fetchMediaAsset, getPublicUrl, type MediaAsset } from '../../lib/mediaUpload';
import { VaultTrustBadge, formatVaultTimestamp } from '../../components/VaultTrustBadge';

interface ReleasedGroup {
  authorUserId: string;
  authorDisplayName: string;
  release: VaultRelease;
  entries: VaultEntry[];
}

export default function ReleasedToMeScreen() {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<ReleasedGroup[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { byAuthor } = await listReleasedToMe();
      setGroups(byAuthor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load released vaults.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (groups === null && !error) {
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

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
          gap: 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={tokens.color.accentPrimary}
          />
        }
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
              RELEASED TO YOU
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '700', color: tokens.color.textPrimary }}>
              For your eyes
            </Text>
          </View>
        </View>

        {error && (
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
            }}
          >
            <Text style={{ color: tokens.color.danger }}>{error}</Text>
          </View>
        )}

        {(groups ?? []).length === 0 && !error && (
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
              When someone in your family releases their vault to you, it'll show up here.
            </Text>
          </View>
        )}

        {(groups ?? []).map((g) => (
          <AuthorSection key={g.authorUserId} group={g} />
        ))}
      </ScrollView>
    </View>
  );
}

function AuthorSection({ group }: { group: ReleasedGroup }) {
  const { authorDisplayName, entries, release } = group;
  const range = entriesRangeLabel(entries);

  return (
    <View style={{ gap: 12 }}>
      {/* Author heading */}
      <View
        style={{
          backgroundColor: tokens.color.bgVault,
          borderRadius: 18,
          padding: 18,
          gap: 6,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <Text
          style={{
            fontSize: 12,
            color: tokens.color.accentGold,
            fontWeight: '700',
            letterSpacing: 1.2,
          }}
        >
          VAULT FROM {authorDisplayName.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 18, color: 'white', fontWeight: '700' }}>
          {authorDisplayName} released their vault to you.
        </Text>
        <Text style={{ fontSize: 13, color: '#D8C7CC', lineHeight: 19 }}>
          Released {new Date(release.releasedAt).toLocaleDateString()}. The whole trail is below,
          oldest first.
        </Text>
        <VaultTrustBadge />
      </View>

      {/* Entries — oldest first */}
      {entries.length === 0 ? (
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 14,
            padding: 16,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
          }}
        >
          <Text style={{ color: tokens.color.textMuted, lineHeight: 20 }}>
            They haven't added any entries yet. New entries will appear here as soon as they're
            written.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {entries.map((e) => (
            <ReadOnlyEntryCard key={e.id} entry={e} />
          ))}
        </View>
      )}

      {/* Footer summary */}
      {entries.length > 0 && (
        <Text
          style={{
            fontSize: 12,
            color: tokens.color.textMuted,
            textAlign: 'center',
            lineHeight: 18,
            paddingHorizontal: 12,
          }}
        >
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          {range ? ` from ${range}` : ''}.
        </Text>
      )}
    </View>
  );
}

function ReadOnlyEntryCard({ entry }: { entry: VaultEntry }) {
  const [media, setMedia] = useState<MediaAsset | null>(null);
  useEffect(() => {
    if (!entry.mediaAssetId) {
      setMedia(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const m = await fetchMediaAsset(entry.mediaAssetId!);
      if (!cancelled) setMedia(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.mediaAssetId]);

  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        gap: 10,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: tokens.color.textMuted,
          fontWeight: '600',
        }}
      >
        {formatVaultTimestamp(entry.createdAt)}
      </Text>
      {media && (
        <Image
          source={{ uri: getPublicUrl(media) }}
          style={{
            width: '100%',
            aspectRatio: media.width && media.height ? media.width / media.height : 4 / 3,
            borderRadius: 10,
            backgroundColor: tokens.color.bgTinted,
          }}
          resizeMode="cover"
        />
      )}
      <Text style={{ fontSize: 15, color: tokens.color.textPrimary, lineHeight: 23 }}>
        {entry.body}
      </Text>
      <VaultTrustBadge compact />
    </View>
  );
}

function entriesRangeLabel(entries: VaultEntry[]): string | null {
  if (entries.length === 0) return null;
  const oldest = new Date(entries[0]!.createdAt);
  const newest = new Date(entries[entries.length - 1]!.createdAt);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (oldest.getTime() === newest.getTime()) return fmt(oldest);
  return `${fmt(oldest)} to ${fmt(newest)}`;
}

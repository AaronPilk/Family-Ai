/**
 * Vault home — the author's view of their own proof-of-life journal.
 *
 * Two sections:
 *   - Entries: chronological list of everything they've added, most recent first.
 *   - Releases: any active vault_releases this user has created.
 *
 * The whole screen is read-only summary; new entries go through /vault/add and
 * new releases through /vault/release.
 */
import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
  Text,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  listMyVaultItems,
  listMyReleases,
  formatReleaseStatus,
  type VaultEntry,
  type VaultRelease,
} from '../../lib/supabaseVault';
import { useMyUserId } from '../../lib/sessionStore';
import { VaultTrustBadge, formatVaultTimestamp } from '../../components/VaultTrustBadge';

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const userId = useMyUserId();
  const [entries, setEntries] = useState<VaultEntry[] | null>(null);
  const [releases, setReleases] = useState<VaultRelease[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'mine' | 'for_me'>('mine');

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const [e, r] = await Promise.all([listMyVaultItems(), listMyReleases()]);
      setEntries(e);
      setReleases(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your vault.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh whenever the screen comes back into focus (e.g. after adding).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const activeReleases = (releases ?? []).filter((r) => r.status !== 'revoked');

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
          gap: 20,
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
              PRIVATE
            </Text>
            <Text style={{ fontSize: 26, fontWeight: '700', color: tokens.color.textPrimary }}>
              Vault
            </Text>
          </View>
        </View>

        {/* Intro card */}
        <View
          style={{
            backgroundColor: tokens.color.bgVault,
            borderRadius: 20,
            padding: 20,
            gap: 10,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
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
            YOUR PRIVATE JOURNAL
          </Text>
          <Text style={{ fontSize: 18, color: 'white', fontWeight: '700', lineHeight: 24 }}>
            Nothing here is shared until you say so.
          </Text>
          <Text style={{ fontSize: 13, color: '#D8C7CC', lineHeight: 19 }}>
            Add what you're doing — workouts, work check-ins, sober days, a note about your kid. The
            server stamps the time. Later, you can release the whole trail to someone who needs to
            see it.
          </Text>
          <VaultTrustBadge />
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
                {id === 'mine' ? 'My vault' : 'Released to me'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'mine' ? (
          <MineTab
            entries={entries}
            releases={activeReleases}
            loading={loading}
            error={error}
            onRetry={() => void load()}
          />
        ) : (
          <ForMeTab />
        )}
      </ScrollView>
    </View>
  );
}

// ---- "Mine" tab -------------------------------------------------------------

function MineTab({
  entries,
  releases,
  loading,
  error,
  onRetry,
}: {
  entries: VaultEntry[] | null;
  releases: VaultRelease[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading && entries === null) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator color={tokens.color.accentPrimary} />
      </View>
    );
  }
  if (error) {
    return (
      <View
        style={{
          backgroundColor: tokens.color.bgPrimary,
          borderRadius: 16,
          padding: 18,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
        }}
      >
        <Text style={{ color: tokens.color.danger, marginBottom: 8 }}>{error}</Text>
        <Pressable onPress={onRetry}>
          <Text style={{ color: tokens.color.accentPrimary, fontWeight: '600' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const list = entries ?? [];

  return (
    <>
      {/* Add CTA */}
      <Pressable
        onPress={() => router.push('/vault/add')}
        style={({ pressed }) => ({
          backgroundColor: tokens.color.accentPrimary,
          padding: 18,
          borderRadius: 16,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 22, marginTop: -3 }}>+</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Add to vault</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>
            One short entry. Server-stamped. No edits.
          </Text>
        </View>
      </Pressable>

      {/* Releases section */}
      <ReleasesSection releases={releases} />

      {/* Entries */}
      <View style={{ gap: 6 }}>
        <Text
          style={{
            fontSize: 12,
            color: tokens.color.textMuted,
            fontWeight: '700',
            letterSpacing: 1.2,
          }}
        >
          ENTRIES
        </Text>
        {list.length === 0 ? (
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
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📓</Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: tokens.color.textPrimary,
                textAlign: 'center',
              }}
            >
              No entries yet.
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
              Add one short entry now — a sentence about today. Build the trail slowly.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {list.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </View>
        )}
      </View>
    </>
  );
}

function ReleasesSection({ releases }: { releases: VaultRelease[] }) {
  if (releases.length === 0) {
    return (
      <Pressable
        onPress={() => router.push('/vault/release')}
        style={({ pressed }) => ({
          backgroundColor: tokens.color.bgPrimary,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: tokens.color.bgTinted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 18 }}>🔓</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: tokens.color.textPrimary }}>
            Release your vault
          </Text>
          <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
            When you're ready, send the whole trail to someone.
          </Text>
        </View>
        <Text style={{ color: tokens.color.textMuted, fontSize: 22 }}>›</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
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
          RELEASES
        </Text>
        <Pressable onPress={() => router.push('/vault/release')} hitSlop={8}>
          <Text style={{ color: tokens.color.accentPrimary, fontWeight: '600', fontSize: 13 }}>
            + New
          </Text>
        </Pressable>
      </View>
      <View style={{ gap: 8 }}>
        {releases.map((r) => (
          <ReleaseCard key={r.id} release={r} />
        ))}
      </View>
    </View>
  );
}

function ReleaseCard({ release }: { release: VaultRelease }) {
  const statusBg: Record<string, string> = {
    immediate: '#E1F1E7',
    'time-locked': '#FFF1E0',
    unlocked: '#E1F1E7',
    'pending-join': '#FFF1E0',
    revoked: '#F1E7EA',
  };
  const statusFg: Record<string, string> = {
    immediate: '#286B43',
    'time-locked': tokens.color.accentGold,
    unlocked: '#286B43',
    'pending-join': tokens.color.accentGold,
    revoked: tokens.color.textMuted,
  };

  const recipientLine =
    release.recipientEmail ??
    (release.recipientUserId ? 'A family member' : 'Someone (pending)');

  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: tokens.color.bgTinted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 18 }}>📤</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.color.textPrimary }}>
          To {recipientLine}
        </Text>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 2 }}>
          Released {new Date(release.releasedAt).toLocaleDateString()}
          {release.unlockAt
            ? ` · unlocks ${new Date(release.unlockAt).toLocaleDateString()}`
            : ''}
        </Text>
      </View>
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          backgroundColor: statusBg[release.status],
          borderRadius: 999,
        }}
      >
        <Text style={{ color: statusFg[release.status], fontSize: 11, fontWeight: '700' }}>
          {formatReleaseStatus(release.status)}
        </Text>
      </View>
    </View>
  );
}

function EntryCard({ entry }: { entry: VaultEntry }) {
  return (
    <Pressable
      onPress={() => router.push(`/vault/${entry.id}`)}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.85 : 1,
        gap: 10,
      })}
    >
      <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '600' }}>
        {formatVaultTimestamp(entry.createdAt)}
      </Text>
      <Text
        style={{ fontSize: 15, color: tokens.color.textPrimary, lineHeight: 22 }}
        numberOfLines={5}
      >
        {entry.body}
      </Text>
      <VaultTrustBadge compact />
    </Pressable>
  );
}

// ---- "For me" tab -----------------------------------------------------------

function ForMeTab() {
  return (
    <Pressable
      onPress={() => router.push('/vault/released-to-me')}
      style={({ pressed }) => ({
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 18,
        padding: 22,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        opacity: pressed ? 0.9 : 1,
        gap: 10,
      })}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: tokens.color.bgTinted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 24 }}>🔒</Text>
      </View>
      <Text
        style={{
          fontSize: 17,
          fontWeight: '700',
          color: tokens.color.textPrimary,
        }}
      >
        Vaults released to you
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: tokens.color.textMuted,
          lineHeight: 20,
        }}
      >
        When someone in your family releases their vault to you, it shows up here — calm, scrollable,
        chronological.
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: tokens.color.accentPrimary,
          fontWeight: '600',
          marginTop: 4,
        }}
      >
        Open
      </Text>
    </Pressable>
  );
}

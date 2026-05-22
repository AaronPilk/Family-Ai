import { View, Text } from 'react-native';
import { tokens } from '../theme/tokens';

/**
 * Tiny "Server-stamped · Append-only" pill. Used on every vault entry card to
 * remind the author (and later, the recipient) that this trail is forensic —
 * nothing here was edited or backdated.
 */
export function VaultTrustBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 3 : 5,
        backgroundColor: 'rgba(192, 145, 85, 0.12)',
        borderRadius: 999,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ fontSize: compact ? 10 : 11, color: tokens.color.accentGold }}>🕒</Text>
      <Text
        style={{
          fontSize: compact ? 10 : 11,
          fontWeight: '700',
          color: tokens.color.accentGold,
          letterSpacing: 0.4,
        }}
      >
        SERVER-STAMPED
      </Text>
      <Text
        style={{
          fontSize: compact ? 10 : 11,
          color: tokens.color.accentGold,
          opacity: 0.7,
        }}
      >
        ·
      </Text>
      <Text
        style={{
          fontSize: compact ? 10 : 11,
          fontWeight: '700',
          color: tokens.color.accentGold,
          letterSpacing: 0.4,
        }}
      >
        APPEND-ONLY
      </Text>
    </View>
  );
}

/**
 * Friendly server-stamped timestamp formatter. Used on entry cards.
 */
export function formatVaultTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Sender's view of one of their own letters.
 *
 * Reads through letters_for_sender so read_at can NEVER appear here unless
 * the recipient explicitly chose to share it. We additionally render a softer
 * "they haven't decided" footnote when recipient_has_decided is false — this
 * tells the sender that the silence isn't bug-vs-feature.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../theme/tokens';
import {
  type LetterForSender,
  getCachedDisplayNameForUser,
  getLetterFromMe,
  senderStatusLabel,
  subscribeToMyLetterChanges,
  whenAgoFromIso,
} from '../../../lib/supabaseLetters';

export default function LetterSenderView() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const letterId = Array.isArray(id) ? id[0] : id;
  const [letter, setLetter] = useState<LetterForSender | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!letterId) {
      setLetter(null);
      return;
    }
    const l = await getLetterFromMe(letterId);
    setLetter(l);
  }, [letterId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        await refresh();
        if (!active) return;
      })();
      return () => {
        active = false;
      };
    }, [refresh]),
  );

  // Realtime: if the recipient flips to "yes" while the user is sitting on
  // this screen, the pill should change from Delivered to Read.
  useEffect(() => {
    const unsub = subscribeToMyLetterChanges(() => {
      refresh().catch(() => {});
    });
    return unsub;
  }, [refresh]);

  if (letter === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
        <Header insetTop={insets.top} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={tokens.color.accentPrimary} />
        </View>
      </View>
    );
  }

  if (letter === null) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
        <Header insetTop={insets.top} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: tokens.color.textMuted, textAlign: 'center' }}>
            This letter isn’t available.
          </Text>
        </View>
      </View>
    );
  }

  const recipientName =
    getCachedDisplayNameForUser(letter.recipientUserId) || 'them';
  const status = senderStatusLabel(letter);
  const statusIsRead = Boolean(letter.visibleReadAt);
  const sentDate = new Date(letter.sentAt).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <Header insetTop={insets.top} />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
          gap: 18,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text
            style={{
              fontSize: 12,
              letterSpacing: 1.4,
              color: tokens.color.textMuted,
              fontWeight: '700',
            }}
          >
            TO
          </Text>
          <Text
            style={{ fontSize: 22, color: tokens.color.textPrimary, fontWeight: '700' }}
          >
            {recipientName}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>{sentDate}</Text>
        </View>

        <View
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: statusIsRead
              ? tokens.color.accentPrimary + '18'
              : tokens.color.bgTinted,
            borderRadius: 999,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: statusIsRead
                ? tokens.color.accentPrimary
                : tokens.color.textSecondary,
            }}
          >
            {status}
            {statusIsRead && letter.visibleReadAt
              ? ` · ${new Date(letter.visibleReadAt).toLocaleString()}`
              : ''}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            padding: 20,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              lineHeight: 26,
              color: tokens.color.textPrimary,
            }}
            selectable
          >
            {letter.body}
          </Text>
        </View>

        {/*
          Footnote logic:
            - Read with visibility: we already show "Read 2h ago" in the pill;
              no extra footnote.
            - Recipient has decided but chose to hide: we MUST NOT reveal that
              they decided (would leak the choice). Render the same neutral
              "Delivered" with no extra footnote — looks identical to the
              "not yet decided" state IF they haven't read it. To avoid
              leaking via subtle UI difference, we use a generic phrasing
              in both undecided cases.
            - Not yet decided: same neutral state.
        */}
        {!statusIsRead && (
          <Text
            style={{
              fontSize: 13,
              color: tokens.color.textMuted,
              lineHeight: 19,
              fontStyle: 'italic',
            }}
          >
            They haven’t chosen to share a read receipt. You may only ever see “Delivered.”
          </Text>
        )}

        <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>
          Sent {whenAgoFromIso(letter.sentAt)}
        </Text>
      </ScrollView>
    </View>
  );
}

function Header({ insetTop }: { insetTop: number }) {
  return (
    <View
      style={{
        paddingTop: insetTop + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
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
          Your letter
        </Text>
      </View>
    </View>
  );
}

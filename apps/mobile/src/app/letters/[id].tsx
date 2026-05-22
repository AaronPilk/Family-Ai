/**
 * Recipient read view. Opening an envelope, not a chat.
 *
 * - markLetterRead fires once on mount if the letter hasn't been read yet.
 * - The decision prompt (Yes/No) is gated: it doesn't appear until the user
 *   has had time to actually read the letter (either they scrolled to the
 *   bottom or 6 seconds have passed — whichever comes first).
 * - Choice is permanent and posted via decideLetterVisibility. After deciding,
 *   the chip at the bottom shows their permanent state. They can keep re-reading
 *   the letter — the decision locks the *receipt visibility*, not the letter.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  type Letter,
  decideLetterVisibility,
  getCachedDisplayNameForUser,
  getLetterToMe,
  markLetterRead,
} from '../../lib/supabaseLetters';

// Envelope palette — calm and low-contrast, distinct from chat bubbles.
const ENVELOPE_BG = '#FAF3E7'; // soft cream
const ENVELOPE_INK = '#2A2018';

const REVEAL_TIMEOUT_MS = 6000;

export default function LetterReadView() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const letterId = Array.isArray(id) ? id[0] : id;

  const [letter, setLetter] = useState<Letter | null | undefined>(undefined); // undefined = loading
  const [revealed, setRevealed] = useState(false);
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch the letter, then fire markLetterRead silently if needed.
  useEffect(() => {
    let active = true;
    if (!letterId) {
      setLetter(null);
      return;
    }
    (async () => {
      const l = await getLetterToMe(letterId);
      if (!active) return;
      setLetter(l);
      if (l && !l.readAt) {
        // Don't await — the user gets to see the letter immediately.
        markLetterRead(l.id).catch(() => {});
      }
    })();
    return () => {
      active = false;
    };
  }, [letterId]);

  // Reveal the decision prompt after a soft timeout — enough time to read at
  // least the first paragraph of even a long letter without rushing the user.
  // If they scroll to the bottom sooner, we reveal early via onScroll.
  useEffect(() => {
    if (!letter) return;
    if (letter.decidedAt) {
      // Already chose — chip-only mode, no timer needed.
      setRevealed(true);
      return;
    }
    revealTimerRef.current = setTimeout(() => setRevealed(true), REVEAL_TIMEOUT_MS);
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [letter]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (revealed) return;
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      // Within 80px of the bottom — they've actually reached the end.
      if (
        contentOffset.y + layoutMeasurement.height >= contentSize.height - 80
      ) {
        setRevealed(true);
      }
    },
    [revealed],
  );

  const onDecide = useCallback(
    async (visible: boolean) => {
      if (!letter || posting) return;
      setPosting(true);
      try {
        await decideLetterVisibility(letter.id, visible);
        setLetter({
          ...letter,
          readVisibleToSender: visible,
          decidedAt: new Date().toISOString(),
        });
        setToast(visible ? 'They’ll see you read it.' : 'Kept private. Only you’ll know.');
        setTimeout(() => {
          router.back();
        }, 1100);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[letter read] decide failed:', err);
        setPosting(false);
        setToast('Couldn’t save that choice. Try again.');
      }
    },
    [letter, posting],
  );

  // ---- Render ---------------------------------------------------------------

  if (letter === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: ENVELOPE_BG }}>
        <Header insetTop={insets.top} bg={ENVELOPE_BG} />
        <Skeleton />
      </View>
    );
  }

  if (letter === null) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
        <Header insetTop={insets.top} bg={tokens.color.bgSecondary} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: tokens.color.textMuted, textAlign: 'center' }}>
            This letter isn’t available.
          </Text>
        </View>
      </View>
    );
  }

  const senderName =
    getCachedDisplayNameForUser(letter.senderUserId) || 'Family member';
  const dateText = new Date(letter.sentAt).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const alreadyDecided = letter.decidedAt != null;

  return (
    <View style={{ flex: 1, backgroundColor: ENVELOPE_BG }}>
      <Header insetTop={insets.top} bg={ENVELOPE_BG} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={120}
        contentContainerStyle={{
          paddingHorizontal: 28,
          paddingTop: 20,
          paddingBottom: insets.bottom + 40,
          gap: 18,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text
            style={{
              fontSize: 12,
              letterSpacing: 1.4,
              color: ENVELOPE_INK + 'AA',
              fontWeight: '700',
            }}
          >
            FROM
          </Text>
          <Text style={{ fontSize: 22, color: ENVELOPE_INK, fontWeight: '700' }}>
            {senderName}
          </Text>
          <Text style={{ fontSize: 13, color: ENVELOPE_INK + 'AA' }}>{dateText}</Text>
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: ENVELOPE_INK + '22',
          }}
        />

        <Text
          // Generous reading font + line-height; mimics letter paper.
          style={{
            fontSize: 17,
            lineHeight: 28,
            color: ENVELOPE_INK,
          }}
          // Preserve whitespace + paragraph breaks the sender wrote.
          selectable
        >
          {letter.body}
        </Text>

        {alreadyDecided ? (
          <View
            style={{
              marginTop: 24,
              alignSelf: 'flex-start',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: ENVELOPE_INK + '11',
            }}
          >
            <Text style={{ fontSize: 13, color: ENVELOPE_INK + 'CC' }}>
              {letter.readVisibleToSender
                ? `You let ${senderName} know you read this.`
                : 'You chose to keep this private.'}
            </Text>
          </View>
        ) : revealed ? (
          <DecisionPrompt
            senderName={senderName}
            posting={posting}
            onYes={() => onDecide(true)}
            onNo={() => onDecide(false)}
          />
        ) : (
          <View style={{ height: 80 }} />
        )}
      </ScrollView>

      {toast && (
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + 24,
            left: 24,
            right: 24,
            backgroundColor: ENVELOPE_INK,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: ENVELOPE_BG, fontWeight: '600' }}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

// ---- Header (matches envelope palette so the top doesn't jar) --------------

function Header({ insetTop, bg }: { insetTop: number; bg: string }) {
  return (
    <View
      style={{
        paddingTop: insetTop + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: bg,
      }}
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(42,32,24,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <Text style={{ fontSize: 20, color: ENVELOPE_INK, marginTop: -2 }}>‹</Text>
      </Pressable>
      <Text style={{ fontSize: 14, color: ENVELOPE_INK + 'AA', letterSpacing: 1.2, fontWeight: '700' }}>
        A LETTER
      </Text>
    </View>
  );
}

// ---- Skeleton --------------------------------------------------------------

function Skeleton() {
  return (
    <View style={{ padding: 28, gap: 14 }}>
      <View
        style={{ height: 14, width: 80, backgroundColor: ENVELOPE_INK + '12', borderRadius: 6 }}
      />
      <View
        style={{ height: 24, width: 180, backgroundColor: ENVELOPE_INK + '14', borderRadius: 6 }}
      />
      <View
        style={{ height: 12, width: 130, backgroundColor: ENVELOPE_INK + '10', borderRadius: 6 }}
      />
      <View style={{ height: 1, backgroundColor: ENVELOPE_INK + '14', marginTop: 8 }} />
      <View style={{ gap: 8, marginTop: 4 }}>
        {[0.95, 0.9, 0.85, 0.7, 0.95, 0.6].map((w, i) => (
          <View
            key={i}
            style={{
              height: 14,
              width: `${w * 100}%`,
              backgroundColor: ENVELOPE_INK + '0E',
              borderRadius: 6,
            }}
          />
        ))}
      </View>
    </View>
  );
}

// ---- Decision prompt -------------------------------------------------------

function DecisionPrompt({
  senderName,
  posting,
  onYes,
  onNo,
}: {
  senderName: string;
  posting: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <View
      style={{
        marginTop: 28,
        paddingTop: 18,
        borderTopWidth: 1,
        borderTopColor: ENVELOPE_INK + '20',
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 15, color: ENVELOPE_INK, fontWeight: '600' }}>
        Want {senderName} to know you read this?
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={onYes}
          disabled={posting}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: ENVELOPE_INK,
            alignItems: 'center',
            opacity: pressed && !posting ? 0.85 : 1,
          })}
        >
          {posting ? (
            <ActivityIndicator color={ENVELOPE_BG} />
          ) : (
            <Text style={{ color: ENVELOPE_BG, fontWeight: '700' }}>Yes — let them know</Text>
          )}
        </Pressable>
        <Pressable
          onPress={onNo}
          disabled={posting}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: ENVELOPE_INK + '55',
            alignItems: 'center',
            opacity: pressed && !posting ? 0.6 : 1,
          })}
        >
          <Text style={{ color: ENVELOPE_INK, fontWeight: '700' }}>No — keep it private</Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 12, color: ENVELOPE_INK + '99', fontStyle: 'italic' }}>
        Your choice is permanent.
      </Text>
    </View>
  );
}

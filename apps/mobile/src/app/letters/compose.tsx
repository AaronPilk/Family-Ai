/**
 * Compose a letter. Recipient picker is a dropdown of family-circle members.
 * No subject, no media, no voice (yet). The send button shows a confirmation
 * modal — letters can't be unsent.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import {
  type LetterRecipientCandidate,
  listLetterRecipientCandidates,
  sendLetter,
} from '../../lib/supabaseLetters';

const SOFT_WARN_AT = 4000;
const HARD_LIMIT = 8000;

export default function LettersCompose() {
  const insets = useSafeAreaInsets();
  const [candidates, setCandidates] = useState<LetterRecipientCandidate[] | null>(null);
  const [recipient, setRecipient] = useState<LetterRecipientCandidate | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [body, setBody] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let active = true;
    listLetterRecipientCandidates()
      .then((rows) => {
        if (!active) return;
        setCandidates(rows);
      })
      .catch(() => {
        if (active) setCandidates([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const charCount = body.length;
  const overSoftWarn = charCount > SOFT_WARN_AT;
  const overHardLimit = charCount > HARD_LIMIT;

  const canSubmit = useMemo(
    () => Boolean(recipient) && body.trim().length > 0 && !overHardLimit && !sending,
    [recipient, body, overHardLimit, sending],
  );

  async function doSend() {
    if (!recipient || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendLetter({
        recipient_user_id: recipient.userId,
        body: body.trim(),
      });
      setConfirmOpen(false);
      // Back to the index, switched to Sent tab implicitly via re-fetch.
      router.replace('/letters');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send.');
      setSending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <Header insetTop={insets.top} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 24,
            gap: 16,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <RecipientField
            recipient={recipient}
            candidates={candidates}
            onOpen={() => setPickerOpen(true)}
          />

          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: tokens.color.textSecondary,
                letterSpacing: 0.5,
              }}
            >
              YOUR LETTER
            </Text>
            <TextInput
              ref={inputRef}
              value={body}
              onChangeText={setBody}
              multiline
              placeholder="Write whatever you couldn’t say out loud."
              placeholderTextColor={tokens.color.textMuted}
              textAlignVertical="top"
              style={{
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
                padding: 16,
                minHeight: 260,
                fontSize: 16,
                color: tokens.color.textPrimary,
                lineHeight: 24,
              }}
            />
            {overSoftWarn && (
              <Text
                style={{
                  fontSize: 12,
                  color: overHardLimit ? tokens.color.danger : tokens.color.warning,
                }}
              >
                {overHardLimit
                  ? `Too long. Letters max out at ${HARD_LIMIT.toLocaleString()} characters.`
                  : `${charCount.toLocaleString()} characters — long letters are fine, but consider whether what matters most is at the top.`}
              </Text>
            )}
          </View>

          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 14,
              padding: 14,
              gap: 6,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: tokens.color.textSecondary,
                lineHeight: 19,
              }}
            >
              Letters are private and one-shot. After you send, the recipient chooses whether
              you’ll ever know they read it. You may only ever see “Delivered.”
            </Text>
          </View>

          <Text
            style={{
              fontSize: 12,
              color: tokens.color.textMuted,
              fontStyle: 'italic',
            }}
          >
            🎤 Voice letters coming soon. For now, text only.
          </Text>

          {error && (
            <Text style={{ color: tokens.color.danger, fontSize: 13 }}>{error}</Text>
          )}

          <Pressable
            onPress={() => canSubmit && setConfirmOpen(true)}
            disabled={!canSubmit}
            style={({ pressed }) => ({
              backgroundColor: canSubmit
                ? tokens.color.accentPrimary
                : tokens.color.borderStrong,
              borderRadius: 999,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: pressed && canSubmit ? 0.85 : 1,
            })}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>
              Send letter
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <RecipientPickerModal
        visible={pickerOpen}
        candidates={candidates}
        onPick={(c) => {
          setRecipient(c);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />

      <ConfirmModal
        visible={confirmOpen}
        recipientName={recipient?.displayName}
        sending={sending}
        onCancel={() => !sending && setConfirmOpen(false)}
        onConfirm={doSend}
      />
    </View>
  );
}

// ---- Header ----------------------------------------------------------------

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
          New letter
        </Text>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 1 }}>
          Take your time.
        </Text>
      </View>
    </View>
  );
}

// ---- Recipient field -------------------------------------------------------

function RecipientField({
  recipient,
  candidates,
  onOpen,
}: {
  recipient: LetterRecipientCandidate | null;
  candidates: LetterRecipientCandidate[] | null;
  onOpen: () => void;
}) {
  const loading = candidates === null;
  const empty = candidates !== null && candidates.length === 0;

  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: tokens.color.textSecondary,
          letterSpacing: 0.5,
        }}
      >
        TO
      </Text>
      <Pressable
        onPress={() => !loading && !empty && onOpen()}
        disabled={loading || empty}
        style={({ pressed }) => ({
          backgroundColor: tokens.color.bgPrimary,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
          paddingHorizontal: 14,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          {loading ? (
            <ActivityIndicator color={tokens.color.accentPrimary} />
          ) : empty ? (
            <Text style={{ fontSize: 14, color: tokens.color.textMuted }}>
              No family members yet — invite someone first.
            </Text>
          ) : recipient ? (
            <Text style={{ fontSize: 16, color: tokens.color.textPrimary, fontWeight: '600' }}>
              {recipient.displayName}
            </Text>
          ) : (
            <Text style={{ fontSize: 16, color: tokens.color.textMuted }}>
              Choose a family member
            </Text>
          )}
        </View>
        {!loading && !empty && (
          <Text style={{ fontSize: 18, color: tokens.color.textMuted }}>›</Text>
        )}
      </Pressable>
    </View>
  );
}

function RecipientPickerModal({
  visible,
  candidates,
  onPick,
  onClose,
}: {
  visible: boolean;
  candidates: LetterRecipientCandidate[] | null;
  onPick: (c: LetterRecipientCandidate) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
        <View
          style={{
            paddingTop: 20,
            paddingHorizontal: 20,
            paddingBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.color.textPrimary }}>
            Who is this for?
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ fontSize: 15, color: tokens.color.accentPrimary, fontWeight: '700' }}>
              Cancel
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {(candidates ?? []).map((c) => (
            <Pressable
              key={c.userId}
              onPress={() => onPick(c)}
              style={({ pressed }) => ({
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
                paddingHorizontal: 16,
                paddingVertical: 14,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: tokens.color.textPrimary }}>
                {c.displayName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---- Confirm send ----------------------------------------------------------

function ConfirmModal({
  visible,
  recipientName,
  sending,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  recipientName?: string;
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(26,20,24,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 20,
            padding: 22,
            gap: 12,
            width: '100%',
            maxWidth: 380,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.color.textPrimary }}>
            Send to {recipientName ?? 'them'}?
          </Text>
          <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 21 }}>
            You can’t unsend a letter. After they read it, they choose whether you’ll ever know.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Pressable
              onPress={onCancel}
              disabled={sending}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: 999,
                backgroundColor: tokens.color.bgTinted,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: tokens.color.textPrimary, fontWeight: '700' }}>Wait</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={sending}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: 999,
                backgroundColor: tokens.color.accentPrimary,
                alignItems: 'center',
                opacity: pressed && !sending ? 0.85 : 1,
              })}
            >
              {sending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontWeight: '700' }}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

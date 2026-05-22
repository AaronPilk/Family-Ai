/**
 * The "Answer one question" surface — Family Memory side of FamLink.
 *
 * Pulls one curated prompt at a time from prompt_templates, lets the user
 * type or speak a short answer, and persists it as a memory_item via the
 * answer_prompt_template RPC. After save we fetch the next eligible
 * question and slide it into the card.
 *
 * Surface decisions:
 *  - Single, oversized question card. No list, no scroll-through. This is
 *    explicitly designed for parents/grandparents on their phone — one good
 *    question is enough today, more tomorrow.
 *  - Coral primary CTA for Save & next; subtle text button for Skip.
 *  - Streak chip below the card so progress is visible without being loud.
 *  - Voice/photo buttons are visual placeholders (comingSoon) until the
 *    recording stack is wired; the spec says voice is out of scope unless
 *    it's already present in the repo, and it isn't.
 */

import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { useMyUserId } from '../../lib/sessionStore';
import { useAnswerSession, milestoneForCount } from '../../lib/answerSessionStore';
import { comingSoon } from '../../lib/comingSoon';
import {
  fetchNextQuestion,
  submitAnswer,
  countMyAnswers,
  isFallbackQuestion,
  SupabaseMemoryError,
  type PromptTemplate,
} from '../../lib/supabaseMemory';
import {
  getPublicUrl,
  pickImage,
  uploadMedia,
  MediaUploadError,
  type MediaAsset,
} from '../../lib/mediaUpload';

export default function AnswerTodayScreen() {
  const insets = useSafeAreaInsets();
  const userId = useMyUserId();
  const { skippedIds, skip, markCelebrated, celebratedMilestones } = useAnswerSession();

  const [question, setQuestion] = useState<PromptTemplate | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [toast, setToast] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<number | null>(null);
  const [attachment, setAttachment] = useState<MediaAsset | null>(null);
  const [attaching, setAttaching] = useState(false);

  async function handleAttachPhoto() {
    if (attaching || submitting) return;
    setErrMsg(null);
    setAttaching(true);
    try {
      const picked = await pickImage({ mediaTypes: 'photo' });
      if (!picked) {
        setAttaching(false);
        return;
      }
      const asset = await uploadMedia(picked, { kind: 'photo' });
      setAttachment(asset);
    } catch (e) {
      setErrMsg(
        e instanceof MediaUploadError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Couldn't attach that photo.",
      );
    } finally {
      setAttaching(false);
    }
  }

  const loadNext = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErrMsg(null);
    try {
      const next = await fetchNextQuestion(userId, skippedIds);
      if (next == null) {
        setQuestion(null);
        setExhausted(true);
      } else {
        setQuestion(next);
        setExhausted(false);
      }
      setDraft('');
    } catch (e) {
      const msg =
        e instanceof SupabaseMemoryError
          ? e.message
          : 'We had trouble loading your next question. Try again in a moment.';
      setErrMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [userId, skippedIds]);

  const refreshCount = useCallback(async () => {
    if (!userId) return;
    try {
      const c = await countMyAnswers(userId);
      setCount(c);
    } catch {
      // Silent — count is decorative; failure shouldn't block answering.
    }
  }, [userId]);

  useEffect(() => {
    loadNext();
    refreshCount();
    // We intentionally don't re-run when skippedIds changes — skipping
    // fetches the next question explicitly inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Auto-dismiss the saved toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  function handleSkip() {
    if (!question) return;
    skip(question.id);
    loadNext();
  }

  async function handleSave() {
    if (!question || !draft.trim() || submitting) return;

    if (isFallbackQuestion(question.id)) {
      // Local fallback questions can't be persisted — they exist so the screen
      // isn't dead when seeds are missing. Skip past them instead.
      setErrMsg(
        "We're still loading your real prompts. This one's a sample — tap Skip to move on.",
      );
      return;
    }

    setSubmitting(true);
    setErrMsg(null);
    try {
      await submitAnswer({
        questionId: question.id,
        body: draft,
        mediaAssetId: attachment?.id,
      });
      setToast('✓ Saved to your timeline');

      const newCount = count + 1;
      setCount(newCount);

      const milestone = milestoneForCount(newCount);
      if (milestone && !celebratedMilestones.includes(milestone)) {
        markCelebrated(milestone);
        setCelebrating(milestone);
      }

      // Reset attachment for the next question.
      setAttachment(null);

      // Move on after a brief beat so the toast is readable.
      setTimeout(() => {
        setSubmitting(false);
        loadNext();
      }, 800);
    } catch (e) {
      setSubmitting(false);
      const msg =
        e instanceof SupabaseMemoryError
          ? e.message
          : "Couldn't save your answer. Check your connection and try again.";
      setErrMsg(msg);
    }
  }

  if (!userId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: tokens.color.textMuted }}>Please sign in to answer questions.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 60,
          gap: 22,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
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
            <Text style={{ fontSize: 20, color: tokens.color.textPrimary }}>‹</Text>
          </Pressable>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: tokens.color.textPrimary }}>
              Your story
            </Text>
            <Text style={{ fontSize: 13, color: tokens.color.textMuted }}>
              One question at a time. No rush.
            </Text>
          </View>
        </View>

        {/* Celebration banner */}
        {celebrating && (
          <CelebrationBanner count={celebrating} onClose={() => setCelebrating(null)} />
        )}

        {/* Toast */}
        {toast && (
          <View
            style={{
              backgroundColor: '#E7F4EC',
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 14,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: tokens.color.success, fontWeight: '600' }}>{toast}</Text>
          </View>
        )}

        {/* Error banner */}
        {errMsg && (
          <View
            style={{
              backgroundColor: '#FFEDED',
              borderRadius: 14,
              padding: 14,
            }}
          >
            <Text style={{ color: tokens.color.danger, fontSize: 14, lineHeight: 20 }}>
              {errMsg}
            </Text>
          </View>
        )}

        {/* The question card */}
        {loading ? (
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 24,
              padding: 36,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 220,
            }}
          >
            <ActivityIndicator color={tokens.color.accentPrimary} />
          </View>
        ) : exhausted ? (
          <ExhaustedState
            onViewTimeline={() => router.push(`/timeline/${userId}` as never)}
          />
        ) : question ? (
          <>
            <View
              style={{
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 24,
                padding: 24,
                gap: 16,
                shadowColor: tokens.color.accentPrimary,
                shadowOpacity: 0.08,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 6 },
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
              }}
            >
              <Text
                style={{
                  color: tokens.color.accentPrimary,
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 1.5,
                }}
              >
                A QUESTION FOR YOU
              </Text>
              <Text
                style={{
                  color: tokens.color.textPrimary,
                  fontSize: 26,
                  lineHeight: 36,
                  fontWeight: '600',
                }}
              >
                {question.body}
              </Text>
              <View
                style={{
                  backgroundColor: tokens.color.bgSecondary,
                  borderRadius: 16,
                  padding: 14,
                  minHeight: 140,
                }}
              >
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Type a few sentences — even a quick note is gold to your family."
                  placeholderTextColor={tokens.color.textMuted}
                  multiline
                  editable={!submitting}
                  style={{
                    color: tokens.color.textPrimary,
                    fontSize: 17,
                    lineHeight: 24,
                    minHeight: 110,
                    textAlignVertical: 'top',
                  }}
                />
              </View>
              {/* Voice placeholder stays parked (see spec: voice is out of
                  scope). Photo now flows through mediaUpload. */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SecondaryAction label="🎤 Voice" onPress={() => comingSoon('record_voice')} />
                <SecondaryAction
                  label={
                    attaching ? 'Uploading…' : attachment ? '✓ Photo attached' : '📷 Photo'
                  }
                  onPress={handleAttachPhoto}
                  disabled={attaching || submitting}
                  active={!!attachment}
                />
              </View>
              {attachment && (
                <View
                  style={{
                    backgroundColor: tokens.color.bgSecondary,
                    borderRadius: 12,
                    padding: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Image
                    source={{ uri: getPublicUrl(attachment) }}
                    style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: tokens.color.bgTinted }}
                  />
                  <Text style={{ flex: 1, fontSize: 13, color: tokens.color.textSecondary }}>
                    This photo will land on your timeline with your answer.
                  </Text>
                  <Pressable onPress={() => setAttachment(null)} hitSlop={8}>
                    <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 12 }}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              )}
              <Pressable
                onPress={handleSave}
                disabled={!draft.trim() || submitting}
                style={({ pressed }) => ({
                  backgroundColor: draft.trim()
                    ? tokens.color.accentPrimary
                    : '#D8C7CC',
                  opacity: pressed ? 0.85 : 1,
                  height: 54,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                    Save & next
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={handleSkip}
                disabled={submitting}
                style={({ pressed }) => ({
                  alignSelf: 'center',
                  paddingVertical: 6,
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text style={{ color: tokens.color.textMuted, fontSize: 14, fontWeight: '600' }}>
                  Skip for now
                </Text>
              </Pressable>
            </View>

            {/* Streak / progress widget */}
            <Pressable
              onPress={() => router.push(`/timeline/${userId}` as never)}
              style={({ pressed }) => ({
                backgroundColor: tokens.color.bgTinted,
                borderRadius: 18,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: tokens.color.textPrimary,
                  }}
                >
                  {count} {count === 1 ? 'answer' : 'answers'} so far
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: tokens.color.textMuted,
                    marginTop: 4,
                  }}
                >
                  Your personal timeline is growing
                </Text>
              </View>
              <Text
                style={{
                  color: tokens.color.accentPrimary,
                  fontWeight: '700',
                  fontSize: 22,
                }}
              >
                →
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SecondaryAction({
  label,
  onPress,
  disabled,
  active,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        height: 42,
        borderRadius: 12,
        backgroundColor: active ? tokens.color.accentPrimary : tokens.color.bgTinted,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed || disabled ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: active ? 'white' : tokens.color.accentPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ExhaustedState({ onViewTimeline }: { onViewTimeline: () => void }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 24,
        padding: 28,
        gap: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
      }}
    >
      <Text style={{ fontSize: 40 }}>📖</Text>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color: tokens.color.textPrimary,
          textAlign: 'center',
        }}
      >
        You've answered everything we have for you.
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: tokens.color.textSecondary,
          textAlign: 'center',
          lineHeight: 22,
        }}
      >
        Your family is going to love reading this. We'll send more questions
        as they come in.
      </Text>
      <Pressable
        onPress={onViewTimeline}
        style={({ pressed }) => ({
          backgroundColor: tokens.color.accentPrimary,
          paddingHorizontal: 22,
          paddingVertical: 12,
          borderRadius: 999,
          opacity: pressed ? 0.85 : 1,
          marginTop: 6,
        })}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>See your timeline</Text>
      </Pressable>
    </View>
  );
}

function CelebrationBanner({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.accentPrimary,
        borderRadius: 20,
        padding: 18,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 28 }}>🎉</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18 }}>×</Text>
        </Pressable>
      </View>
      <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', lineHeight: 26 }}>
        You've shared {count} memories with your family.
      </Text>
      <Text style={{ color: '#FFD8E0', fontSize: 14, lineHeight: 20 }}>
        Every answer is one more page in the book they'll read for years.
      </Text>
    </View>
  );
}

import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../theme/tokens';
import { createEventPoll } from '../../../lib/supabaseEvents';
import { useEvent } from '../../../lib/eventStore';

/**
 * /moment/[id]/new-poll
 *
 * Freeform poll create: question + 2+ options, single-choice, posted to
 * event_polls + event_poll_options. Replaces the previous "+ New poll"
 * comingSoon stub.
 *
 * Why no kind picker? The existing event_polls.kind taxonomy
 * (date/location/activity) is for future templated quick-polls. Until
 * those land, every user-created poll is just 'custom' — a free-text
 * question that the host wants the family to vote between.
 *
 * The voting + display side of polls still reads in-memory mock data on
 * /moment/[id]/polls (separate cleanup). For now, this screen creates the
 * row; refresh the polls list later to see it once the read path is wired.
 */

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

export default function NewPollScreen() {
  const insets = useSafeAreaInsets();
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(eventId ?? '');

  const [prompt, setPrompt] = useState('');
  // Start with two empty option rows — the minimum needed to vote between.
  const [options, setOptions] = useState<string[]>(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
  const canSubmit =
    prompt.trim().length > 0 && cleanedOptions.length >= MIN_OPTIONS && !submitting;

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(index: number) {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  const handleSubmit = useCallback(async () => {
    if (!eventId || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createEventPoll(eventId, prompt, options, 'custom');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the poll.');
    } finally {
      setSubmitting(false);
    }
  }, [eventId, canSubmit, prompt, options]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: tokens.color.borderSubtle,
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
          <Text style={{ fontSize: 20, color: tokens.color.textPrimary, marginTop: -2 }}>
            ‹
          </Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: tokens.color.accentPrimary,
              letterSpacing: 1.5,
            }}
          >
            {(event?.title ?? 'EVENT').toUpperCase()}
          </Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
            New poll
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 140,
          gap: 18,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 21 }}>
          Ask the family something and let them vote.
        </Text>

        {/* Prompt */}
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 6,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: tokens.color.textMuted,
              fontWeight: '700',
              letterSpacing: 0.5,
            }}
          >
            QUESTION
          </Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g. What time should we eat?"
            placeholderTextColor={tokens.color.textMuted}
            style={{
              fontSize: 17,
              color: tokens.color.textPrimary,
              fontWeight: '500',
              minHeight: 22,
            }}
            multiline
          />
        </View>

        {/* Options */}
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.5,
              color: tokens.color.textMuted,
              paddingHorizontal: 4,
            }}
          >
            OPTIONS
          </Text>
          {options.map((opt, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: tokens.color.bgTinted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: tokens.color.textMuted,
                  }}
                >
                  {idx + 1}
                </Text>
              </View>
              <TextInput
                value={opt}
                onChangeText={(v) => updateOption(idx, v)}
                placeholder={`Option ${idx + 1}`}
                placeholderTextColor={tokens.color.textMuted}
                style={{ flex: 1, fontSize: 15, color: tokens.color.textPrimary }}
              />
              {options.length > MIN_OPTIONS && (
                <Pressable
                  onPress={() => removeOption(idx)}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.5 : 1,
                  })}
                >
                  <Text style={{ fontSize: 16, color: tokens.color.textMuted, marginTop: -2 }}>
                    ×
                  </Text>
                </Pressable>
              )}
            </View>
          ))}

          {options.length < MAX_OPTIONS && (
            <Pressable
              onPress={addOption}
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginTop: 4,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: tokens.color.accentPrimary,
                }}
              >
                + Add another option
              </Text>
            </Pressable>
          )}
        </View>

        {error && (
          <View
            style={{
              backgroundColor: tokens.color.danger + '15',
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: tokens.color.danger + '40',
            }}
          >
            <Text style={{ color: tokens.color.danger, fontSize: 13 }}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky submit */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: tokens.color.bgSecondary,
          borderTopWidth: 1,
          borderTopColor: tokens.color.borderSubtle,
        }}
      >
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => ({
            backgroundColor: canSubmit ? tokens.color.accentPrimary : '#D8C7CC',
            height: 52,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 10,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {submitting && <ActivityIndicator color="white" />}
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
            {submitting ? 'Creating…' : 'Post poll'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

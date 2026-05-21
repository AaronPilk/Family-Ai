import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ScrollView, View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { INBOX, MEMBERS } from '../../lib/mockData';
import { Avatar } from '../../components/Avatar';

type Mode = 'voice' | 'video' | 'text';

export default function AnswerQuestion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const question = INBOX.find((q) => q.id === id);
  const [mode, setMode] = useState<Mode>('voice');
  const [recording, setRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [text, setText] = useState('');

  if (!question) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: tokens.color.textMuted }}>Question not found.</Text>
      </View>
    );
  }

  const from = MEMBERS[question.fromId];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 40,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}>
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
          <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
            Answer
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 22 }}>
          {/* Question card */}
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar member={from} size="md" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: tokens.color.accentPrimary, fontWeight: '700', letterSpacing: 1 }}>
                  {from.relationship.toUpperCase()} ASKED
                </Text>
                <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
                  {from.name} · {question.whenAgo}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 19, lineHeight: 28, color: tokens.color.textPrimary, fontWeight: '500' }}>
              {question.body}
            </Text>
          </View>

          {/* Mode picker */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 12,
              padding: 4,
            }}
          >
            {(['voice', 'video', 'text'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setMode(m);
                  setRecording(false);
                  setHasRecording(false);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: mode === m ? tokens.color.bgPrimary : 'transparent',
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: mode === m ? tokens.color.textPrimary : tokens.color.textMuted,
                  }}
                >
                  {m === 'voice' ? '🎤 Voice' : m === 'video' ? '🎥 Video' : '✍️ Type'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Recording surface */}
          {(mode === 'voice' || mode === 'video') && (
            <View
              style={{
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 20,
                padding: 24,
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
                alignItems: 'center',
                gap: 18,
                minHeight: 280,
                justifyContent: 'center',
              }}
            >
              <Pressable
                onPress={() => {
                  if (!recording && !hasRecording) {
                    setRecording(true);
                  } else if (recording) {
                    setRecording(false);
                    setHasRecording(true);
                  }
                }}
                style={({ pressed }) => ({
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: recording ? '#9B294A' : tokens.color.accentPrimary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.8 : 1,
                  shadowColor: tokens.color.accentPrimary,
                  shadowOpacity: 0.35,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 6 },
                })}
              >
                <Text style={{ fontSize: 38 }}>
                  {hasRecording ? '✓' : recording ? '◼' : mode === 'voice' ? '🎤' : '🎥'}
                </Text>
              </Pressable>
              <Text
                style={{
                  fontSize: 15,
                  color: tokens.color.textSecondary,
                  textAlign: 'center',
                  maxWidth: 260,
                  lineHeight: 21,
                }}
              >
                {hasRecording
                  ? `Your ${mode === 'voice' ? 'voice note' : 'video'} is ready. Tap send below.`
                  : recording
                    ? `Recording… tap to stop.`
                    : `Tap to record your ${mode === 'voice' ? 'voice answer' : 'video answer'}.`}
              </Text>
              {hasRecording && (
                <Pressable
                  onPress={() => {
                    setHasRecording(false);
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.8 })}
                >
                  <Text style={{ color: tokens.color.textMuted, fontSize: 13, fontWeight: '600' }}>
                    Re-record
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {mode === 'text' && (
            <View
              style={{
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 20,
                padding: 16,
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
                minHeight: 200,
              }}
            >
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Type your answer…"
                placeholderTextColor={tokens.color.textMuted}
                multiline
                style={{
                  fontSize: 17,
                  color: tokens.color.textPrimary,
                  lineHeight: 24,
                  minHeight: 160,
                  textAlignVertical: 'top',
                }}
              />
            </View>
          )}

          {/* Visibility chip */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ fontSize: 13, color: tokens.color.textMuted, fontWeight: '600' }}>
              VISIBLE TO
            </Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor: '#FFE3EA',
                borderRadius: 999,
              }}
            >
              <Text style={{ color: tokens.color.accentPrimary, fontSize: 12, fontWeight: '700' }}>
                Just you and {from.name}
              </Text>
            </View>
          </View>

          {/* Send */}
          <Pressable
            disabled={!hasRecording && !text.trim()}
            onPress={() => router.replace('/(tabs)')}
            style={({ pressed }) => ({
              backgroundColor: hasRecording || text.trim()
                ? tokens.color.accentPrimary
                : '#D8C7CC',
              height: 56,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>
              Send answer to {from.name}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

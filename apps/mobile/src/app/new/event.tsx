import { useState } from 'react';
import { router } from 'expo-router';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { type EventKind } from '../../lib/mockData';
import { createEventFromInput } from '../../lib/eventStore';

const KIND_OPTIONS: { id: EventKind; label: string; glyph: string; tint: string }[] = [
  { id: 'reunion', label: 'Family reunion', glyph: '🌾', tint: '#E8B274' },
  { id: 'vacation', label: 'Vacation', glyph: '🏖', tint: '#9BC7E4' },
  { id: 'holiday', label: 'Holiday', glyph: '🎄', tint: '#C0345C' },
  { id: 'gathering', label: 'Get-together', glyph: '🎉', tint: '#9BC97A' },
  { id: 'other', label: 'Something else', glyph: '✨', tint: '#C09155' },
];

const COVER_GLYPHS = ['🌾', '🏖', '🍂', '🎄', '🎂', '✈️', '🍷', '🏕', '🎉', '⛵️', '🌻', '🏔'];

// Loose RFC-5321-ish email regex. Not exhaustive, but rejects the most common
// junk we'd otherwise send to Supabase (e.g. "<aaron@example.com>", "foo@",
// "@bar.com", or names with embedded commas). Strict validation happens at
// the auth layer when the invitee actually signs up; this is just a cheap
// pre-flight so we don't poison event_guests rows with garbage.
const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function parseEmails(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\s\n;]+/)
        // Strip common decorations: "Aaron <aaron@example.com>", quoted
        // names, surrounding angle brackets, trailing punctuation.
        .map((s) => {
          const trimmed = s.trim();
          // If wrapped like "Display <addr>", extract the inside.
          const angle = trimmed.match(/<([^>]+)>/);
          const candidate = (angle ? angle[1] : trimmed) ?? '';
          return candidate.replace(/^[<"'(]+|[>"')]+$/g, '').trim().toLowerCase();
        })
        .filter((s) => s.length > 0 && EMAIL_RE.test(s)),
    ),
  );
}

export default function NewEvent() {
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<EventKind>('reunion');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [glyph, setGlyph] = useState(COVER_GLYPHS[0]!);
  const [inviteEmailsRaw, setInviteEmailsRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedEmails = parseEmails(inviteEmailsRaw);
  const canSave = title.trim().length > 0 && !busy;

  async function handleSave() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const kindMeta = KIND_OPTIONS.find((k) => k.id === kind)!;
      const eventId = await createEventFromInput({
        title: title.trim(),
        kind,
        startsAt: startsAt.trim() || undefined,
        endsAt: endsAt.trim() || startsAt.trim() || undefined,
        locationText: location.trim() || undefined,
        coverTint: kindMeta.tint,
        coverGlyph: glyph,
        inviteEmails: parsedEmails,
      });
      router.replace(`/moment/${eventId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the event. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header insets={insets} title="New event" />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
          gap: 22,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 28, fontWeight: '700', color: tokens.color.textPrimary }}>
          Get the family together
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: tokens.color.textSecondary,
            lineHeight: 22,
            marginTop: -10,
          }}
        >
          Pick a kind, give it a name, invite people by email. They'll get a link to join the chat
          and RSVP.
        </Text>

        {/* Kind picker */}
        <Section label="WHAT KIND OF EVENT?">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {KIND_OPTIONS.map((k) => {
              const active = kind === k.id;
              return (
                <Pressable
                  key={k.id}
                  onPress={() => setKind(k.id)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: active ? tokens.color.bgTinted : tokens.color.bgPrimary,
                    borderWidth: 1.5,
                    borderColor: active ? tokens.color.accentPrimary : tokens.color.borderSubtle,
                    opacity: pressed ? 0.7 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  })}
                >
                  <Text style={{ fontSize: 18 }}>{k.glyph}</Text>
                  <Text
                    style={{ fontSize: 14, fontWeight: '600', color: tokens.color.textPrimary }}
                  >
                    {k.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Field label="WHAT'S IT CALLED?">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Pilks Family Reunion 2026"
            placeholderTextColor={tokens.color.textMuted}
            style={{ fontSize: 18, color: tokens.color.textPrimary, fontWeight: '500' }}
          />
        </Field>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="STARTS (YYYY-MM-DD)">
              <TextInput
                value={startsAt}
                onChangeText={setStartsAt}
                placeholder="2026-07-17"
                placeholderTextColor={tokens.color.textMuted}
                style={{ fontSize: 15, color: tokens.color.textPrimary }}
                autoCapitalize="none"
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="ENDS (YYYY-MM-DD)">
              <TextInput
                value={endsAt}
                onChangeText={setEndsAt}
                placeholder="2026-07-20"
                placeholderTextColor={tokens.color.textMuted}
                style={{ fontSize: 15, color: tokens.color.textPrimary }}
                autoCapitalize="none"
              />
            </Field>
          </View>
        </View>

        <Field label="WHERE?">
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Aunt Susan's place, Hudson Valley NY"
            placeholderTextColor={tokens.color.textMuted}
            style={{ fontSize: 15, color: tokens.color.textPrimary }}
          />
        </Field>

        {/* Cover glyph */}
        <Section label="COVER">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {COVER_GLYPHS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGlyph(g)}
                style={({ pressed }) => ({
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor:
                    g === glyph ? tokens.color.accentPrimary + '15' : tokens.color.bgPrimary,
                  borderWidth: 1.5,
                  borderColor: g === glyph ? tokens.color.accentPrimary : tokens.color.borderSubtle,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 22 }}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Invite — share-link first, email as power-user fallback */}
        <Section label="INVITE FAMILY">
          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: tokens.color.accentPrimary + '30',
              padding: 14,
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 22 }}>💬</Text>
            <Text
              style={{ fontSize: 15, fontWeight: '700', color: tokens.color.textPrimary }}
            >
              Drop a link in your family group chat
            </Text>
            <Text
              style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 19 }}
            >
              After you create this event, tap{' '}
              <Text style={{ fontWeight: '700' }}>Share link</Text> on the event page. Anyone who
              taps it joins your family and sees this event automatically. Works in iMessage,
              WhatsApp, anywhere — no email required.
            </Text>
          </View>

          <Text
            style={{
              fontSize: 11,
              color: tokens.color.textMuted,
              fontWeight: '700',
              marginTop: 10,
            }}
          >
            OR INVITE SPECIFIC PEOPLE BY EMAIL (OPTIONAL)
          </Text>
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: tokens.color.borderSubtle,
              paddingHorizontal: 14,
              paddingVertical: 10,
              minHeight: 72,
            }}
          >
            <TextInput
              value={inviteEmailsRaw}
              onChangeText={setInviteEmailsRaw}
              placeholder="mom@example.com, brother@example.com"
              placeholderTextColor={tokens.color.textMuted}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={{
                fontSize: 15,
                color: tokens.color.textPrimary,
                lineHeight: 22,
                minHeight: 56,
                textAlignVertical: 'top',
              }}
            />
          </View>
          {parsedEmails.length > 0 && (
            <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 6 }}>
              Will pre-create guest records for {parsedEmails.length}{' '}
              {parsedEmails.length === 1 ? 'person' : 'people'}.
            </Text>
          )}
        </Section>

        {error && (
          <View
            style={{
              backgroundColor: tokens.color.danger + '18',
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: tokens.color.danger + '40',
            }}
          >
            <Text style={{ color: tokens.color.danger, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Save */}
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={({ pressed }) => ({
            backgroundColor: canSave ? tokens.color.accentPrimary : '#D8C7CC',
            height: 56,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            flexDirection: 'row',
            gap: 10,
          })}
        >
          {busy && <ActivityIndicator color="white" />}
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>
            {busy ? 'Creating…' : 'Create event'}
          </Text>
        </Pressable>
        <Text
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: tokens.color.textMuted,
            marginTop: -10,
            lineHeight: 18,
          }}
        >
          You'll get a share link on the next screen — drop it into your family group chat.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Text
        style={{ fontSize: 11, color: tokens.color.textMuted, marginBottom: 4, fontWeight: '700' }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Header({ insets, title }: { insets: { top: number }; title: string }) {
  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
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
        <Text style={{ fontSize: 20, color: tokens.color.textPrimary, marginTop: -2 }}>‹</Text>
      </Pressable>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
        {title}
      </Text>
    </View>
  );
}

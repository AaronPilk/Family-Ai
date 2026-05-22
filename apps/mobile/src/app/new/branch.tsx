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
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';

/**
 * Multi-branch creation flow. Branches are separate family spaces for blended
 * families, in-laws, or chosen family — nothing crosses over between branches.
 * Persistence to Supabase lands in a future update; for now the screen captures
 * the inputs and confirms the intent so the UX is real even though the
 * branch isn't created server-side yet.
 */
export default function NewBranch() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [first, setFirst] = useState('');

  function handleSave() {
    if (!name.trim()) return;
    Alert.alert(
      'Saved for later',
      `Multi-branch support — separate spaces for in-laws, divorced parents, or chosen family — is in active development. "${name.trim()}" will be created the moment that flow ships. In the meantime, your invite link adds everyone into one circle.`,
      [{ text: 'Got it', onPress: () => router.back() }],
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
          Start a new branch
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 22 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text
            style={{
              fontSize: 26,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              lineHeight: 32,
            }}
          >
            A separate space for a different family.
          </Text>
          <Text style={{ fontSize: 15, color: tokens.color.textSecondary, lineHeight: 22 }}>
            Branches are private islands. Nothing crosses over. Use one for in-laws, divorced
            parents, chosen family, or a tighter inner circle.
          </Text>
        </View>

        <Field label="WHAT'S IT CALLED?">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. The Smiths"
            placeholderTextColor={tokens.color.textMuted}
            style={{ fontSize: 18, color: tokens.color.textPrimary, fontWeight: '500' }}
          />
        </Field>

        <Field label="INVITE THE FIRST PERSON (OPTIONAL)">
          <TextInput
            value={first}
            onChangeText={setFirst}
            placeholder="Phone or email"
            placeholderTextColor={tokens.color.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ fontSize: 16, color: tokens.color.textPrimary }}
          />
        </Field>

        <Pressable
          onPress={handleSave}
          disabled={!name.trim()}
          style={({ pressed }) => ({
            backgroundColor: name.trim() ? tokens.color.accentPrimary : '#D8C7CC',
            height: 56,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>Create branch</Text>
        </Pressable>
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

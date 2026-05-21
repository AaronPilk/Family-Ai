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
 * v0: branches are baked into mockData. Creating a brand-new branch from the UI
 * is a Phase-1 flow (real Supabase). This screen captures the inputs and shows
 * how the flow will look — saving funnels back to Family with an explainer.
 */
export default function NewBranch() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [first, setFirst] = useState('');

  function handleSave() {
    if (!name.trim()) return;
    Alert.alert(
      'Branch saved',
      `"${name.trim()}" will exist as a separate space once real auth is wired (Batch 1). For now, you can preview multi-branch UX via the demo toggle on the Family tab.`,
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
          <Text style={{ fontSize: 26, fontWeight: '700', color: tokens.color.textPrimary, lineHeight: 32 }}>
            A separate space for a different family.
          </Text>
          <Text style={{ fontSize: 15, color: tokens.color.textSecondary, lineHeight: 22 }}>
            Branches are private islands. Nothing crosses over. Use one for in-laws, divorced parents, chosen family, or a tighter inner circle.
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
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 17 }}>
            Create branch
          </Text>
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
      <Text style={{ fontSize: 11, color: tokens.color.textMuted, marginBottom: 4, fontWeight: '700' }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

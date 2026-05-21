import { useState } from 'react';
import { router } from 'expo-router';
import {
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
import { supabase } from '../../lib/supabase';

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !submitting;

  async function handleSignIn() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    // onAuthStateChange in sessionStore will flip the root index to /(tabs).
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
        }}
      >
        {/* Back chevron */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            padding: 8,
            marginLeft: -8,
            marginBottom: 16,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text style={{ fontSize: 22, color: tokens.color.textPrimary }}>←</Text>
        </Pressable>

        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: tokens.color.textPrimary,
            marginBottom: 8,
          }}
        >
          Welcome back
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: tokens.color.textSecondary,
            lineHeight: 24,
            marginBottom: 28,
          }}
        >
          Sign in to FamLink with the email you used to set up your family.
        </Text>

        <Field label="EMAIL">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={tokens.color.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            style={{ fontSize: 17, color: tokens.color.textPrimary, fontWeight: '500' }}
          />
        </Field>
        <View style={{ height: 12 }} />
        <Field label="PASSWORD">
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={tokens.color.textMuted}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
            style={{ fontSize: 17, color: tokens.color.textPrimary, fontWeight: '500' }}
          />
        </Field>

        {error && (
          <Text
            style={{
              color: tokens.color.danger,
              fontSize: 13,
              marginTop: 12,
              lineHeight: 18,
            }}
          >
            {error}
          </Text>
        )}

        <View style={{ marginTop: 24, gap: 12 }}>
          <Pressable
            onPress={handleSignIn}
            disabled={!canSubmit}
            style={({ pressed }) => ({
              backgroundColor: canSubmit ? tokens.color.accentPrimary : '#D8C7CC',
              opacity: pressed ? 0.85 : 1,
              height: 56,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
            })}
          >
            {submitting && <ActivityIndicator color="white" />}
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 17 }}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(auth)/sign-up')}
            style={({ pressed }) => ({
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={{ color: tokens.color.textSecondary, fontWeight: '500' }}>
              New here? <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700' }}>Create an account</Text>
            </Text>
          </Pressable>
        </View>
      </View>
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
        style={{
          fontSize: 11,
          color: tokens.color.textMuted,
          marginBottom: 4,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

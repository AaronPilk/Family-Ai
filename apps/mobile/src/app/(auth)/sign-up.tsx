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
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';

/**
 * Sign-up. Creates the auth.users row via supabase.auth.signUp; the public
 * profile (name, birthday, role) is collected in the onboarding flow that
 * follows. Email confirmation is on in supabase/config.toml, so we route to
 * a "check your email" state once the request succeeds.
 */
export default function SignUp() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordMismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 8 &&
    confirm === password &&
    !submitting;

  async function handleSignUp() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);

    // Two paths from Supabase:
    //  - email confirmation ON → data.session is null, user must verify email
    //  - email confirmation OFF → data.session is populated, route into onboarding
    if (data.session) {
      router.replace('/onboarding/name');
    } else {
      setConfirmSent(true);
    }
  }

  if (confirmSent) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.color.bgSecondary,
          paddingTop: insets.top + 64,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
          gap: 16,
        }}
      >
        <Text style={{ fontSize: 48, textAlign: 'center' }}>✉️</Text>
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: tokens.color.textPrimary,
            textAlign: 'center',
            lineHeight: 34,
          }}
        >
          Check your email.
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: tokens.color.textSecondary,
            textAlign: 'center',
            lineHeight: 23,
          }}
        >
          We sent a confirmation link to {email.trim()}. Tap it on this device to finish setting up
          your FamLink account.
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.replace('/(auth)/sign-in')}
          style={({ pressed }) => ({
            backgroundColor: tokens.color.accentPrimary,
            height: 56,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 17 }}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          gap: 18,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back chevron */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            padding: 8,
            marginLeft: -8,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text style={{ fontSize: 22, color: tokens.color.textPrimary }}>←</Text>
        </Pressable>

        <View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              marginBottom: 8,
            }}
          >
            Create your FamLink
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: tokens.color.textSecondary,
              lineHeight: 24,
            }}
          >
            Start with an email and password. We'll set up your family next.
          </Text>
        </View>

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

        <Field label="PASSWORD">
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={tokens.color.textMuted}
            secureTextEntry
            returnKeyType="next"
            style={{ fontSize: 17, color: tokens.color.textPrimary, fontWeight: '500' }}
          />
        </Field>
        {passwordTooShort && (
          <Text style={{ color: tokens.color.warning, fontSize: 12, marginTop: -10 }}>
            8 characters minimum.
          </Text>
        )}

        <Field label="CONFIRM PASSWORD">
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Type it again"
            placeholderTextColor={tokens.color.textMuted}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignUp}
            style={{ fontSize: 17, color: tokens.color.textPrimary, fontWeight: '500' }}
          />
        </Field>
        {passwordMismatch && (
          <Text style={{ color: tokens.color.warning, fontSize: 12, marginTop: -10 }}>
            Passwords don't match.
          </Text>
        )}

        {error && (
          <Text style={{ color: tokens.color.danger, fontSize: 13, lineHeight: 18 }}>{error}</Text>
        )}

        <View style={{ marginTop: 8, gap: 12 }}>
          <Pressable
            onPress={handleSignUp}
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
              {submitting ? 'Creating…' : 'Create account'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(auth)/sign-in')}
            style={({ pressed }) => ({
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={{ color: tokens.color.textSecondary, fontWeight: '500' }}>
              Already have an account?{' '}
              <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700' }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            fontSize: 11,
            color: tokens.color.textMuted,
            lineHeight: 16,
            textAlign: 'center',
            marginTop: 12,
          }}
        >
          By continuing you agree to FamLink's Terms and Privacy Policy. FamLink is a private space
          for your family — we never sell your data.
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

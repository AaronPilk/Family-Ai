import { useState } from 'react';
import { router } from 'expo-router';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingHeader, PrimaryNext } from './name';

const RELATIONSHIPS = [
  'Mom',
  'Dad',
  'Brother',
  'Sister',
  'Grandma',
  'Grandpa',
  'Stepparent',
  'Partner',
  'Aunt',
  'Uncle',
  'Cousin',
  'Friend',
];

export default function InviteFirst() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [rel, setRel] = useState<string | null>('Mom');

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          gap: 28,
        }}
      >
        <OnboardingHeader step={2} total={3} />

        <View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              lineHeight: 34,
            }}
          >
            Invite the first person.
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: tokens.color.textSecondary,
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            They'll get a soft text or email. They don't need to do anything until they're ready.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Field label="THEIR NAME">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Linda"
              placeholderTextColor={tokens.color.textMuted}
              style={{ fontSize: 20, color: tokens.color.textPrimary, fontWeight: '500' }}
            />
          </Field>
          <Field label="PHONE OR EMAIL">
            <TextInput
              value={contact}
              onChangeText={setContact}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor={tokens.color.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ fontSize: 17, color: tokens.color.textPrimary }}
            />
          </Field>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12, color: tokens.color.textMuted, fontWeight: '700' }}>
            HOW ARE THEY RELATED TO YOU?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {RELATIONSHIPS.map((r) => {
              const active = r === rel;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRel(r)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? tokens.color.accentPrimary : tokens.color.bgPrimary,
                    borderWidth: 1,
                    borderColor: active ? tokens.color.accentPrimary : tokens.color.borderSubtle,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: active ? 'white' : tokens.color.textPrimary,
                      fontWeight: '600',
                      fontSize: 14,
                    }}
                  >
                    {r}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <PrimaryNext
            label="Send invite"
            onPress={() => router.push('/onboarding/how-it-works')}
          />
          <Pressable
            onPress={() => router.push('/onboarding/how-it-works')}
            style={({ pressed }) => ({
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={{ color: tokens.color.textSecondary, fontWeight: '500' }}>
              I'll invite people later →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
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
      <Text style={{ fontSize: 11, color: tokens.color.textMuted, marginBottom: 4 }}>{label}</Text>
      {children}
    </View>
  );
}

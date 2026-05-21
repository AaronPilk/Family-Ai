import { router } from 'expo-router';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingHeader, PrimaryNext } from './name';

export default function HowItWorks() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          gap: 24,
        }}
      >
        <OnboardingHeader step={3} total={3} />

        <View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              lineHeight: 34,
            }}
          >
            How Kin works.
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: tokens.color.textSecondary,
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            One answer. Three places it lives. Forever.
          </Text>
        </View>

        {/* The story card — visual explainer */}
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: tokens.color.borderSubtle,
            gap: 14,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              color: tokens.color.accentPrimary,
              fontWeight: '700',
              letterSpacing: 1,
            }}
          >
            EXAMPLE
          </Text>
          <Text
            style={{
              fontSize: 17,
              lineHeight: 24,
              color: tokens.color.textPrimary,
              fontWeight: '500',
            }}
          >
            You ask Mom:{' '}
            <Text style={{ fontStyle: 'italic' }}>
              "What did you eat with Chicken in a Biskit crackers as a kid?"
            </Text>
          </Text>
          <Text
            style={{
              fontSize: 17,
              lineHeight: 24,
              color: tokens.color.textPrimary,
              fontWeight: '500',
            }}
          >
            Mom records a 47-second voice answer.
          </Text>
          <View style={{ gap: 10, marginTop: 4 }}>
            <FanOutLine label="Mom's life story" subtitle="Every memory she's ever shared" />
            <FanOutLine label="You ↔ Mom" subtitle="The story between just the two of you" />
            <FanOutLine label="Food memories" subtitle="A topic timeline across the whole family" />
          </View>
          <Text
            style={{ fontSize: 14, color: tokens.color.textMuted, lineHeight: 20, marginTop: 4 }}
          >
            One answer, three places. Search any of them, find it. Print a book of any of them, it's
            organized.
          </Text>
        </View>

        {/* Three short principles */}
        <View style={{ gap: 14 }}>
          <Principle
            title="You decide who sees what."
            body="Every answer has a visibility chip — just you and the person you asked, the whole family, or locked in your vault. Defaults to the most private option."
          />
          <Principle
            title="Nothing gets lost."
            body="Voice notes get transcribed. Old photos get tagged. Every memory is searchable. When you want a book one day, it's already organized."
          />
          <Principle
            title="There's no algorithm."
            body="No likes, no streaks, no public posts. Kin is just for the people you invited."
          />
        </View>

        <PrimaryNext label="Enter Kin" onPress={() => router.replace('/(tabs)')} />
      </ScrollView>
    </View>
  );
}

function FanOutLine({ label, subtitle }: { label: string; subtitle: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: tokens.color.bgTinted,
        borderRadius: 10,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: tokens.color.accentPrimary,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: tokens.color.accentPrimary }}>
          {label}
        </Text>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted, marginTop: 1 }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function Principle({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
        {title}
      </Text>
      <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
        {body}
      </Text>
    </View>
  );
}

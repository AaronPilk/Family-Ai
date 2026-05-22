import { router } from 'expo-router';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingDots, PrimaryButton } from './_shared';

/**
 * Onboarding step 2 of 4 — what FamLink is.
 *
 * Three bullets that map to the three product modes:
 *   - Events (live today)
 *   - Stories / Questions (live today)
 *   - Letters + Vault (live today — the relationship-repair arc)
 *
 * No interaction — just orientation. Continue moves to /onboarding/role.
 */
export default function OnboardingHowItWorks() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
          gap: 28,
        }}
      >
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1.5,
              color: tokens.color.accentPrimary,
            }}
          >
            WHAT YOU CAN DO HERE
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              lineHeight: 34,
            }}
          >
            Three ways to stay close.
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          <ModeBullet
            glyph="🎉"
            title="Plan family time"
            body="Reunions, vacations, holidays. Group chat, polls, packing lists, and the photos and videos from everyone in one place after."
          />
          <ModeBullet
            glyph="📖"
            title="Collect stories"
            body="Soft daily questions for your parents and grandparents. Their answers stitch together into a personal timeline that lasts forever."
          />
          <ModeBullet
            glyph="💌"
            title="Say the hard things"
            body="Private letters and a time-locked vault — for words that need to be said but not heard yet."
          />
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 28,
          paddingBottom: insets.bottom + 20,
          paddingTop: 12,
          gap: 16,
        }}
      >
        <PrimaryButton label="Next" onPress={() => router.replace('/onboarding/role')} />
        <OnboardingDots step={2} total={4} />
      </View>
    </View>
  );
}

function ModeBullet({
  glyph,
  title,
  body,
  comingSoon,
}: {
  glyph: string;
  title: string;
  body: string;
  comingSoon?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 18,
        padding: 18,
        flexDirection: 'row',
        gap: 14,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: tokens.color.bgTinted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 24 }}>{glyph}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
            {title}
          </Text>
          {comingSoon ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                backgroundColor: tokens.color.bgTinted,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: tokens.color.accentPrimary,
                  letterSpacing: 0.8,
                }}
              >
                COMING SOON
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
          {body}
        </Text>
      </View>
    </View>
  );
}

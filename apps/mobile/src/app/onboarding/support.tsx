import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingDots, PrimaryButton } from './_shared';
import { markAsFriendsAndFamily, startCheckout } from '../../lib/billing';

/**
 * Onboarding step 5 of 6 — Support FamLink.
 *
 * Shows the pricing transparently ($19.99/year) but defaults everyone to the
 * Friends & Family free tier. The "Activate Free" button is primary; the
 * "Support" button routes to Stripe Checkout. Anyone who declines either is
 * still moved forward — the f_and_f activation happens silently on Continue
 * so every account has a defined subscription_status.
 *
 * Rationale: people invited by family deserve to know what FamLink would cost
 * if they were a stranger. Surfacing the price builds trust ("this is what
 * they're giving me free") and gives genuinely-grateful family members a way
 * to tip-jar. Most users tap Free; the conversion-to-paid signal is the
 * relationship value, not the price.
 */
export default function OnboardingSupport() {
  const insets = useSafeAreaInsets();
  const [activating, setActivating] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [activated, setActivated] = useState(false);

  async function activateFreeAndContinue() {
    if (activating || checkingOut) return;
    setActivating(true);
    try {
      await markAsFriendsAndFamily();
      setActivated(true);
    } catch (e) {
      // Don't block onboarding on a billing failure — log and move on.
      // eslint-disable-next-line no-console
      console.warn('[onboarding/support] markAsFriendsAndFamily failed:', e);
    } finally {
      setActivating(false);
      router.replace('/onboarding/install');
    }
  }

  async function payToSupport() {
    if (activating || checkingOut) return;
    setCheckingOut(true);
    try {
      // Mark them as f_and_f first so even if they bail out of Stripe, they
      // come back to an entitled account. The webhook will overwrite this to
      // 'active' if they complete payment.
      try {
        await markAsFriendsAndFamily();
      } catch {
        // ignore — we'll try again on the /billing screen
      }
      await startCheckout();
      // On web, startCheckout redirects, so we don't reach the line below.
      // On native, treat the Linking.openURL return as "user is on Stripe now"
      // and advance — they'll come back to /billing?ok=1 or ?cancel=1.
      router.replace('/onboarding/install');
    } catch (e) {
      Alert.alert(
        'Could not open checkout',
        "We'll keep you on the Friends & Family tier for now. You can support FamLink any time from your profile. " +
          (e instanceof Error ? e.message : ''),
      );
      router.replace('/onboarding/install');
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 36,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          gap: 20,
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
            ONE MORE THING
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              lineHeight: 34,
            }}
          >
            FamLink is free for you.
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: tokens.color.textSecondary,
              marginTop: 4,
              lineHeight: 22,
            }}
          >
            We're in early access. Friends and family get a free year while we
            polish — no payment required. If you want to support what we're
            building, you can.
          </Text>
        </View>

        {/* Pricing card */}
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: tokens.color.borderSubtle,
            padding: 20,
            gap: 14,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: tokens.color.accentPrimary,
                letterSpacing: 1.4,
                marginBottom: 4,
              }}
            >
              FAMLINK ANNUAL
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 34,
                  fontWeight: '800',
                  color: tokens.color.textPrimary,
                }}
              >
                $19.99
              </Text>
              <Text style={{ fontSize: 15, color: tokens.color.textMuted }}>/ year</Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                color: tokens.color.textSecondary,
                marginTop: 4,
              }}
            >
              Full FamLink — letters, vault, events, family tree, every feature.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: tokens.color.bgTinted,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: tokens.color.accentPrimary + '30',
              gap: 4,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: tokens.color.accentPrimary,
              }}
            >
              💚 Friends & Family — free for one year
            </Text>
            <Text style={{ fontSize: 12, color: tokens.color.textSecondary, lineHeight: 17 }}>
              You're invited as a founding family member. No card, no trial
              countdown. Just hit continue.
            </Text>
          </View>
        </View>

        {/* CTAs */}
        <View style={{ gap: 10, marginTop: 4 }}>
          <PrimaryButton
            label={
              activated
                ? "✓ You're in — let's keep going"
                : activating
                  ? 'Activating…'
                  : 'Continue free'
            }
            onPress={activateFreeAndContinue}
            disabled={activating || checkingOut}
            loading={activating}
          />

          <Pressable
            onPress={payToSupport}
            disabled={activating || checkingOut}
            style={({ pressed }) => ({
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: tokens.color.accentPrimary,
              paddingVertical: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              opacity: pressed || activating || checkingOut ? 0.7 : 1,
            })}
          >
            {checkingOut && (
              <ActivityIndicator size="small" color={tokens.color.accentPrimary} />
            )}
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: tokens.color.accentPrimary,
              }}
            >
              {checkingOut ? 'Opening checkout…' : 'Pay $19.99 to support'}
            </Text>
          </Pressable>
        </View>

        <Text
          style={{
            fontSize: 12,
            color: tokens.color.textMuted,
            textAlign: 'center',
            lineHeight: 17,
            paddingHorizontal: 16,
            marginTop: 4,
          }}
        >
          You can switch any time from your profile. Cancel anytime in one tap.
        </Text>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 20,
          paddingTop: 12,
          gap: 16,
        }}
      >
        <OnboardingDots step={5} total={6} />
      </View>
    </View>
  );
}

import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { OnboardingDots, PrimaryButton, SecondaryLink } from './_shared';
import { useMyUserId } from '../../lib/sessionStore';
import { updateProfile } from '../../lib/useProfile';
import { detectInstallPlatform } from '../../lib/pushNotifications';

/**
 * Onboarding step 5 of 5 — Add to home screen + enable notifications coaching.
 *
 * Why this screen exists:
 *   - On iOS 16.4+ Safari, web push only works for PWAs the user has added to
 *     their home screen. No add-to-home-screen = no notifications ever. So we
 *     have to coach them through the Share-sheet → "Add to Home Screen" flow.
 *   - On Android Chrome and desktop, A2HS is helpful but optional. Push works
 *     in-browser. The UI degrades gracefully.
 *
 * This screen is where we flip profiles.onboarding_completed = true (moved
 * here from invite.tsx) so the user lands on Home only after they've seen the
 * install pitch. Both buttons — primary "I added it" and secondary "Skip for
 * now" — write the flag.
 *
 * Notification permission is NOT requested here. We deliberately defer that to
 * PushPermissionModal, which fires only after the user re-opens the app from
 * the home-screen icon (i.e. they're in standalone PWA mode). Asking now would
 * (a) probably show the OS prompt in a non-standalone Safari tab on iOS where
 * it doesn't work, and (b) get denied disproportionately because the user
 * hasn't experienced any value yet.
 */
export default function OnboardingInstall() {
  const insets = useSafeAreaInsets();
  const userId = useMyUserId();
  const [busy, setBusy] = useState<null | 'added' | 'skip'>(null);

  const platform = useMemo<'ios' | 'android' | 'desktop' | 'unknown'>(() => {
    if (Platform.OS !== 'web') return 'unknown';
    return detectInstallPlatform();
  }, []);

  async function finish() {
    if (!userId) return true;
    try {
      await updateProfile(userId, { onboardingCompleted: true });
      return true;
    } catch (e) {
      Alert.alert(
        "Couldn't finish setup",
        "We'll show you onboarding again next time. " +
          (e instanceof Error ? e.message : ''),
      );
      return false;
    }
  }

  async function handleAdded() {
    setBusy('added');
    await finish();
    setBusy(null);
    router.replace('/(tabs)');
  }

  async function handleSkip() {
    setBusy('skip');
    await finish();
    setBusy(null);
    router.replace('/(tabs)');
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 36,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          gap: 22,
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
            ONE LAST STEP
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              lineHeight: 34,
            }}
          >
            Add FamLink to your home screen.
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: tokens.color.textSecondary,
              marginTop: 4,
              lineHeight: 21,
            }}
          >
            So you can open it like an app — and so we can let you know when
            your family joins, sends a letter, or answers a question.
          </Text>
        </View>

        {platform === 'ios' && <IosInstructions />}
        {platform === 'android' && <AndroidInstructions />}
        {(platform === 'desktop' || platform === 'unknown') && <DesktopInstructions />}

        <View
          style={{
            backgroundColor: tokens.color.bgTinted,
            borderRadius: 14,
            padding: 14,
          }}
        >
          <Text style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 19 }}>
            After you add FamLink, open it from your home screen — you'll get a
            gentle prompt to turn on notifications. Nothing loud. Just the
            family stuff.
          </Text>
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 20,
          paddingTop: 12,
          gap: 12,
        }}
      >
        <PrimaryButton
          label="I added it"
          onPress={handleAdded}
          loading={busy === 'added'}
          disabled={busy !== null}
        />
        <SecondaryLink label="Skip for now" onPress={handleSkip} />
        <OnboardingDots step={6} total={6} />
      </View>
    </View>
  );
}

// ---- Per-platform instruction blocks ---------------------------------------

function IosInstructions() {
  return (
    <View style={{ gap: 14 }}>
      <PhoneFrame>
        <SafariShareIllustration />
      </PhoneFrame>

      <Step
        n={1}
        title="Tap the Share icon"
        body="It's at the bottom of Safari — a square with an arrow pointing up."
        glyph={<ShareGlyph />}
      />
      <Step
        n={2}
        title="Scroll down, tap Add to Home Screen"
        body="In the Share sheet, scroll past the apps to find it."
        glyph={<Text style={{ fontSize: 22 }}>＋</Text>}
      />
      <Step
        n={3}
        title="Tap Add"
        body="iOS confirms the name. Tap Add in the top-right."
        glyph={<Text style={{ fontSize: 22 }}>✓</Text>}
      />

      <View
        style={{
          borderRadius: 12,
          padding: 12,
          backgroundColor: tokens.color.bgPrimary,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
        }}
      >
        <Text style={{ fontSize: 12, color: tokens.color.textMuted, lineHeight: 17 }}>
          Notifications need iOS 16.4 or newer. If yours is older,
          FamLink still works — you just won't get push alerts until you update.
        </Text>
      </View>
    </View>
  );
}

function AndroidInstructions() {
  return (
    <View style={{ gap: 14 }}>
      <Step
        n={1}
        title="Tap the ⋮ menu in Chrome"
        body="Top-right of the address bar."
        glyph={<Text style={{ fontSize: 22 }}>⋮</Text>}
      />
      <Step
        n={2}
        title="Tap “Install app” or “Add to Home screen”"
        body="Chrome may also prompt you on its own — either way is fine."
        glyph={<Text style={{ fontSize: 22 }}>＋</Text>}
      />
      <Step
        n={3}
        title="Open FamLink from your home screen"
        body="It'll launch like an app, and notifications will work."
        glyph={<Text style={{ fontSize: 22 }}>🏠</Text>}
      />
    </View>
  );
}

function DesktopInstructions() {
  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          backgroundColor: tokens.color.bgPrimary,
          borderRadius: 16,
          padding: 18,
          borderWidth: 1,
          borderColor: tokens.color.borderSubtle,
          gap: 10,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: tokens.color.textPrimary }}>
          FamLink works in your browser.
        </Text>
        <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
          To get notifications, click the install icon at the right edge of
          your address bar (Chrome or Edge). Or skip — you can always turn
          notifications on later from your profile.
        </Text>
      </View>
    </View>
  );
}

// ---- Reusable bits ---------------------------------------------------------

function Step({
  n,
  title,
  body,
  glyph,
}: {
  n: number;
  title: string;
  body: string;
  glyph?: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        gap: 14,
        borderWidth: 1,
        borderColor: tokens.color.borderSubtle,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: tokens.color.bgTinted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {glyph ?? (
          <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.color.accentPrimary }}>
            {n}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: tokens.color.textPrimary }}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: tokens.color.textSecondary, lineHeight: 18 }}>
          {body}
        </Text>
      </View>
    </View>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  // A stylized "phone with Safari bottom bar showing the share button"
  // illustration. Pure View/SVG so we don't need a screenshot asset.
  return (
    <View
      style={{
        alignSelf: 'center',
        width: 220,
        height: 280,
        backgroundColor: tokens.color.textPrimary,
        borderRadius: 28,
        padding: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.color.bgSecondary,
          borderRadius: 22,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function SafariShareIllustration() {
  // Mock Safari URL bar + FamLink content + bottom toolbar with share icon highlighted.
  return (
    <View style={{ flex: 1, padding: 8, gap: 6 }}>
      {/* Fake URL bar */}
      <View
        style={{
          backgroundColor: tokens.color.bgTinted,
          borderRadius: 8,
          height: 22,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 9, color: tokens.color.textMuted }}>
          famlinkapp.com
        </Text>
      </View>

      {/* Fake content */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: tokens.color.bgTinted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>❤️</Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.color.textPrimary }}>
          FamLink
        </Text>
        <Text style={{ fontSize: 8, color: tokens.color.textMuted }}>
          Memories that last forever.
        </Text>
      </View>

      {/* Fake Safari bottom bar with share button highlighted */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 6,
          backgroundColor: tokens.color.bgPrimary,
          borderRadius: 8,
        }}
      >
        <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>‹</Text>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>›</Text>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: tokens.color.accentPrimary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShareGlyph color="white" size={16} />
        </View>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>☐</Text>
        <Text style={{ fontSize: 12, color: tokens.color.textMuted }}>≡</Text>
      </View>
    </View>
  );
}

function ShareGlyph({ color, size = 18 }: { color?: string; size?: number }) {
  // Apple-style share icon, built from <View> rectangles so we don't have to
  // pull in react-native-svg. The result is a small rounded "box" with an
  // upward arrow rising out of it.
  const tint = color ?? tokens.color.accentPrimary;
  const stroke = Math.max(1.5, Math.round(size * 0.11));
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      {/* The box (open top). */}
      <View
        style={{
          width: size * 0.78,
          height: size * 0.55,
          borderWidth: stroke,
          borderColor: tint,
          borderTopWidth: 0,
          borderRadius: Math.max(2, stroke),
        }}
      />
      {/* The vertical arrow shaft. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          width: stroke,
          height: size * 0.78,
          backgroundColor: tint,
          borderRadius: stroke / 2,
        }}
      />
      {/* Left/right arrow head wings. */}
      <View
        style={{
          position: 'absolute',
          top: stroke,
          left: size * 0.18,
          width: size * 0.32,
          height: stroke,
          backgroundColor: tint,
          borderRadius: stroke / 2,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: stroke,
          right: size * 0.18,
          width: size * 0.32,
          height: stroke,
          backgroundColor: tint,
          borderRadius: stroke / 2,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}

import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { tokens } from '../theme/tokens';
import {
  getPermissionState,
  isPushSupported,
  isStandalonePwa,
  markSoftAskDismissed,
  subscribeToPush,
  wasSoftAskRecentlyDismissed,
} from '../lib/pushNotifications';
import { useMyUserId } from '../lib/sessionStore';

/**
 * Soft-ask modal for web push permission.
 *
 * Bad pattern: calling Notification.requestPermission() on page load. ~70%
 * deny rate, and once denied, only a browser-level action can re-enable it.
 *
 * Good pattern (this): wait until the user is signed in, in standalone PWA
 * mode (iOS gate), permission state is still 'default', and they've been on
 * the page for a few seconds. Then show a friendly card explaining what
 * they'll get. The browser's native permission prompt only fires when they
 * tap "Turn on notifications" — which means they've already said yes once.
 *
 * Mount once at the root via `<PushPermissionModal />` in _layout.tsx. It
 * self-gates and renders nothing in the wrong conditions.
 */

const DELAY_MS = 5000;

export function PushPermissionModal() {
  const userId = useMyUserId();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only on web, only when signed in, only in PWA standalone, only when we
    // haven't already asked, only when we haven't been dismissed recently.
    if (!userId) return;
    if (!isPushSupported()) return;
    if (!isStandalonePwa()) return;
    if (getPermissionState() !== 'default') return;
    if (wasSoftAskRecentlyDismissed()) return;

    const t = setTimeout(() => {
      // Re-check on the timer tick — user might have permission flip while we waited.
      if (getPermissionState() === 'default') {
        setVisible(true);
      }
    }, DELAY_MS);

    return () => clearTimeout(t);
  }, [userId]);

  async function handleEnable() {
    setBusy(true);
    setError(null);
    const result = await subscribeToPush();
    setBusy(false);
    if (result.ok) {
      setVisible(false);
      return;
    }
    if (result.reason === 'denied') {
      // The user said no at the OS level. Don't keep nagging.
      markSoftAskDismissed();
      setVisible(false);
      return;
    }
    if (result.reason === 'no-vapid') {
      setError('Notifications aren’t configured yet. Try again later.');
      return;
    }
    setError(
      result.error ||
        'We couldn’t turn on notifications. You can try again from your profile later.',
    );
  }

  function handleLater() {
    markSoftAskDismissed();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleLater}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(20, 12, 16, 0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: tokens.color.bgPrimary,
            borderRadius: 24,
            padding: 24,
            maxWidth: 380,
            width: '100%',
            gap: 16,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: tokens.color.bgTinted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 28 }}>💌</Text>
          </View>

          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: tokens.color.textPrimary,
              lineHeight: 28,
            }}
          >
            Stay close to your family.
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: tokens.color.textSecondary,
              lineHeight: 21,
            }}
          >
            Get a gentle nudge when your family joins, sends you a letter, or
            answers a question. Nothing else.
          </Text>

          {error ? (
            <Text style={{ fontSize: 13, color: tokens.color.danger }}>{error}</Text>
          ) : null}

          <View style={{ gap: 10, marginTop: 4 }}>
            <Pressable
              onPress={handleEnable}
              disabled={busy}
              style={({ pressed }) => ({
                backgroundColor: busy ? '#D8C7CC' : tokens.color.accentPrimary,
                height: 52,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 10,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {busy ? <ActivityIndicator color="white" /> : null}
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                Turn on notifications
              </Text>
            </Pressable>

            <Pressable
              onPress={handleLater}
              disabled={busy}
              style={({ pressed }) => ({
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.55 : 1,
              })}
            >
              <Text
                style={{
                  color: tokens.color.textSecondary,
                  fontWeight: '500',
                  fontSize: 15,
                }}
              >
                Maybe later
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme/tokens';
import { useMyUserId } from '../../lib/sessionStore';
import {
  getMySubscription,
  isEntitled,
  markAsFriendsAndFamily,
  openCustomerPortal,
  startCheckout,
  type MySubscription,
} from '../../lib/billing';

/**
 * /billing — FamLink Pricing
 *
 * Two CTAs side by side, but laid out as primary (Friends & Family — free)
 * and secondary (real Stripe checkout). Mirrors the layout idiom of
 * /invite/index.tsx (centered scroll view, header with back chevron, cards
 * with rounded corners, accent-pink primary buttons, outlined secondaries).
 *
 * URL params honored on mount:
 *   ?ok=1     — show a "subscribed!" toast and refresh (Stripe success_url)
 *   ?cancel=1 — silent no-op (Stripe cancel_url)
 */
export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const myUuid = useMyUserId();
  const params = useLocalSearchParams<{ ok?: string; cancel?: string }>();

  const [sub, setSub] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState<'fnf' | 'checkout' | 'portal' | null>(null);
  const [toast, setToast] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!myUuid) {
      setError('You need to be signed in to view billing.');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const s = await getMySubscription();
      setSub(s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load your subscription.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [myUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  // Honor the ?ok=1 / ?cancel=1 query params Stripe redirects us back with.
  useEffect(() => {
    if (params?.ok === '1') {
      setToast({
        kind: 'success',
        text: "You're subscribed — welcome to FamLink Pro.",
      });
      void load();
    } else if (params?.cancel === '1') {
      // Silent no-op per spec.
    }
    // We only want this to run once on mount with the initial params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss the toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const status = sub?.status ?? 'none';
  const isPaying = status === 'active' || status === 'trialing';
  const isFreeAndFamily = status === 'f_and_f';
  const isRecoverable = status === 'past_due' || status === 'canceled';

  const handleActivateFnf = useCallback(async () => {
    setSubmitting('fnf');
    setToast(null);
    try {
      const ok = await markAsFriendsAndFamily();
      if (ok) {
        setToast({ kind: 'success', text: "You're in. Free for the F&F launch." });
        await load();
      } else {
        setToast({
          kind: 'info',
          text: "You're already a paying subscriber — nothing changed.",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not activate the free tier.';
      setToast({ kind: 'error', text: msg });
    } finally {
      setSubmitting(null);
    }
  }, [load]);

  const handleStartCheckout = useCallback(async () => {
    setSubmitting('checkout');
    setToast(null);
    try {
      await startCheckout();
      // startCheckout navigates the page away on web; on native it opens the
      // browser. We may not reach the next line on web.
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start checkout.';
      setToast({ kind: 'error', text: msg });
      setSubmitting(null);
    }
  }, []);

  const handleOpenPortal = useCallback(async () => {
    setSubmitting('portal');
    setToast(null);
    try {
      await openCustomerPortal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not open the billing portal.';
      setToast({ kind: 'error', text: msg });
      setSubmitting(null);
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bgSecondary }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: tokens.color.borderSubtle,
          backgroundColor: tokens.color.bgSecondary,
        }}
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/profile');
            }
          }}
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
        <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
          FamLink Pricing
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 40,
          gap: 18,
        }}
      >
        {/* Toast */}
        {toast && <Toast kind={toast.kind} text={toast.text} />}

        {loading && (
          <View style={{ paddingVertical: 60, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={tokens.color.accentPrimary} />
            <Text style={{ color: tokens.color.textMuted, fontSize: 14 }}>
              Loading your subscription…
            </Text>
          </View>
        )}

        {!loading && error && (
          <View
            style={{
              backgroundColor: tokens.color.bgPrimary,
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: tokens.color.danger + '40',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 32 }}>😔</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
              We couldn't load your subscription.
            </Text>
            <Text style={{ fontSize: 14, color: tokens.color.textSecondary, lineHeight: 20 }}>
              {error}
            </Text>
            <Pressable
              onPress={load}
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                marginTop: 4,
                paddingHorizontal: 18,
                paddingVertical: 10,
                backgroundColor: tokens.color.accentPrimary,
                borderRadius: 999,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: 'white', fontWeight: '700' }}>Try again</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && (
          <>
            {/* F&F early-access banner — hidden once they're paying */}
            {!isPaying && (
              <View
                style={{
                  backgroundColor: tokens.color.bgTinted,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: tokens.color.accentSecondary,
                  padding: 16,
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.3,
                    color: tokens.color.accentPrimary,
                  }}
                >
                  EARLY ACCESS
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: tokens.color.textPrimary,
                    lineHeight: 22,
                  }}
                >
                  Friends & family get a free year while we polish.
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: tokens.color.textSecondary,
                    lineHeight: 19,
                  }}
                >
                  We're in early access. Pay only if you want to support what we're building.
                </Text>
              </View>
            )}

            {/* Recovery banner for past-due / canceled */}
            {isRecoverable && (
              <View
                style={{
                  backgroundColor: tokens.color.bgPrimary,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: tokens.color.warning + '60',
                  padding: 16,
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.3,
                    color: tokens.color.warning,
                  }}
                >
                  {status === 'past_due' ? 'PAYMENT FAILED' : 'SUBSCRIPTION CANCELED'}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: tokens.color.textPrimary,
                    lineHeight: 21,
                  }}
                >
                  {status === 'past_due'
                    ? "We couldn't process your last payment."
                    : 'Your subscription has ended.'}
                </Text>
                <Pressable
                  onPress={handleOpenPortal}
                  disabled={submitting === 'portal'}
                  style={({ pressed }) => ({
                    alignSelf: 'flex-start',
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    backgroundColor: tokens.color.accentPrimary,
                    borderRadius: 999,
                    opacity: pressed || submitting === 'portal' ? 0.7 : 1,
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                  })}
                >
                  {submitting === 'portal' && <ActivityIndicator size="small" color="white" />}
                  <Text style={{ color: 'white', fontWeight: '700' }}>
                    {submitting === 'portal' ? 'Opening…' : 'Update payment method'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Pricing card */}
            <View
              style={{
                backgroundColor: tokens.color.bgPrimary,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: tokens.color.borderSubtle,
                padding: 22,
                gap: 12,
                ...(Platform.OS === 'web' ? {} : (tokens.shadow.md as object)),
              }}
            >
              <Text
                style={{
                  fontSize: 36,
                  fontWeight: '800',
                  color: tokens.color.textPrimary,
                  letterSpacing: -1,
                }}
              >
                $19.99
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: tokens.color.textMuted,
                  }}
                >
                  {' '}
                  / year
                </Text>
              </Text>
              <Text style={{ fontSize: 14, color: tokens.color.textSecondary }}>
                Per user · One year of full FamLink
              </Text>

              <View style={{ height: 1, backgroundColor: tokens.color.borderSubtle, marginVertical: 8 }} />

              <Bullet text="Unlimited family circle." />
              <Bullet text="Letters." />
              <Bullet text="Vault." />
              <Bullet text="Events." />
              <Bullet text="All future features for the next year." />
            </View>

            {/* CTA stack */}
            {isPaying ? (
              <ActivePayingCard
                sub={sub!}
                submitting={submitting === 'portal'}
                onManage={handleOpenPortal}
              />
            ) : isFreeAndFamily ? (
              <FnfActiveCard
                submitting={submitting === 'checkout'}
                onUpgrade={handleStartCheckout}
              />
            ) : (
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={handleActivateFnf}
                  disabled={submitting !== null}
                  style={({ pressed }) => ({
                    backgroundColor: tokens.color.accentPrimary,
                    opacity: pressed || submitting !== null ? 0.85 : 1,
                    height: 56,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                  })}
                >
                  {submitting === 'fnf' && <ActivityIndicator size="small" color="white" />}
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                    {submitting === 'fnf'
                      ? 'Activating…'
                      : 'Activate Free — Friends & Family'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleStartCheckout}
                  disabled={submitting !== null}
                  style={({ pressed }) => ({
                    backgroundColor: tokens.color.bgPrimary,
                    borderWidth: 1,
                    borderColor: tokens.color.accentPrimary,
                    opacity: pressed || submitting !== null ? 0.7 : 1,
                    height: 50,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                  })}
                >
                  {submitting === 'checkout' && (
                    <ActivityIndicator size="small" color={tokens.color.accentPrimary} />
                  )}
                  <Text
                    style={{
                      color: tokens.color.accentPrimary,
                      fontWeight: '700',
                      fontSize: 15,
                    }}
                  >
                    {submitting === 'checkout' ? 'Opening Stripe…' : 'Or pay $19.99/year to support'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Footnote */}
            <View
              style={{
                backgroundColor: tokens.color.bgTinted,
                borderRadius: 14,
                padding: 14,
                marginTop: 8,
              }}
            >
              <Text style={{ fontSize: 12, color: tokens.color.textMuted, lineHeight: 18 }}>
                {isPaying || isFreeAndFamily
                  ? 'Thanks for being part of FamLink early access.'
                  : 'Your free Friends & Family year covers everything FamLink can do today and through this launch window. You can switch to a paid subscription any time.'}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ---- Sub-components --------------------------------------------------------

function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Text style={{ fontSize: 16, color: tokens.color.accentPrimary, lineHeight: 22 }}>✓</Text>
      <Text style={{ fontSize: 14, color: tokens.color.textPrimary, lineHeight: 22, flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function ActivePayingCard({
  sub,
  submitting,
  onManage,
}: {
  sub: MySubscription;
  submitting: boolean;
  onManage: () => void;
}) {
  const renews = sub.currentPeriodEnd ? formatLongDate(sub.currentPeriodEnd) : null;
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.color.success + '60',
        padding: 18,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontSize: 28 }}>💖</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
            You're a FamLink supporter.
          </Text>
          {renews && (
            <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
              {sub.status === 'trialing' ? 'Trial ends ' : 'Renews '}
              {renews}
            </Text>
          )}
        </View>
      </View>
      <Pressable
        onPress={onManage}
        disabled={submitting}
        style={({ pressed }) => ({
          backgroundColor: tokens.color.bgPrimary,
          borderWidth: 1,
          borderColor: tokens.color.accentPrimary,
          opacity: pressed || submitting ? 0.7 : 1,
          height: 48,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        })}
      >
        {submitting && <ActivityIndicator size="small" color={tokens.color.accentPrimary} />}
        <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 15 }}>
          {submitting ? 'Opening…' : 'Manage subscription'}
        </Text>
      </Pressable>
    </View>
  );
}

function FnfActiveCard({
  submitting,
  onUpgrade,
}: {
  submitting: boolean;
  onUpgrade: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.bgPrimary,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.color.success + '60',
        padding: 18,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontSize: 28 }}>🎉</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: tokens.color.textPrimary }}>
            You're in!
          </Text>
          <Text style={{ fontSize: 13, color: tokens.color.textMuted, marginTop: 2 }}>
            Friends & Family — free during early access.
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onUpgrade}
        disabled={submitting}
        style={({ pressed }) => ({
          backgroundColor: tokens.color.bgPrimary,
          borderWidth: 1,
          borderColor: tokens.color.accentPrimary,
          opacity: pressed || submitting ? 0.7 : 1,
          height: 48,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        })}
      >
        {submitting && <ActivityIndicator size="small" color={tokens.color.accentPrimary} />}
        <Text style={{ color: tokens.color.accentPrimary, fontWeight: '700', fontSize: 14 }}>
          {submitting ? 'Opening Stripe…' : 'Upgrade to support — $19.99/year'}
        </Text>
      </Pressable>
    </View>
  );
}

function Toast({ kind, text }: { kind: 'success' | 'error' | 'info'; text: string }) {
  const bg =
    kind === 'success'
      ? tokens.color.success + '20'
      : kind === 'error'
        ? tokens.color.danger + '20'
        : tokens.color.bgTinted;
  const color =
    kind === 'success'
      ? tokens.color.success
      : kind === 'error'
        ? tokens.color.danger
        : tokens.color.accentPrimary;
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <Text style={{ fontSize: 13, color, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

// ---- Helpers ---------------------------------------------------------------

function formatLongDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// Suppress unused-import warning if isEntitled is later imported by other
// surfaces; we keep the re-export shape consistent. Today this file doesn't
// directly use it.
void isEntitled;

/**
 * Billing / subscriptions data layer.
 *
 * Three external touch points:
 *   - mark_f_and_f RPC (server: 20260522000018_subscriptions.sql) — flips the
 *     calling user into the free Friends & Family tier.
 *   - stripe_create_checkout edge function — returns a Stripe Checkout URL.
 *   - stripe_create_portal edge function — returns a Stripe Billing Portal URL.
 *
 * The "paywall enabled" toggle is a build-time env var on the client
 * (EXPO_PUBLIC_PAYWALL_ENABLED). Today it's `false`: nothing is actually
 * gated, /billing is purely opt-in. When we flip it to `true`, the UI starts
 * showing a "Subscribe" entry point and the home screen surfaces a
 * paywall_active flag for individual features to consult.
 */

import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';

// ---- Types -----------------------------------------------------------------

export type SubscriptionStatus =
  | 'none'
  | 'f_and_f'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled';

export interface MySubscription {
  status: SubscriptionStatus;
  tier: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

export class BillingError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'BillingError';
    this.cause = cause;
  }
}

// ---- Reads -----------------------------------------------------------------

/**
 * Reads the subscription columns off the calling user's profile. Returns null
 * if no row exists yet (which shouldn't happen post-onboarding, but we'd
 * rather render the F&F CTA than crash).
 */
export async function getMySubscription(): Promise<MySubscription | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'subscription_status, subscription_tier, subscription_current_period_end, stripe_customer_id',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new BillingError(error.message, error);
  if (!data) return null;

  return {
    status: (data.subscription_status as SubscriptionStatus | null) ?? 'none',
    tier: (data.subscription_tier as string | null) ?? 'none',
    currentPeriodEnd: (data.subscription_current_period_end as string | null) ?? null,
    stripeCustomerId: (data.stripe_customer_id as string | null) ?? null,
  };
}

// ---- Paywall toggle --------------------------------------------------------

/**
 * Build-time toggle. When false (today): /billing is purely opt-in, nothing
 * is gated. When true (later): users without an entitling status are bumped
 * to /billing when they try to use gated features.
 */
export function isPaywallEnabled(): boolean {
  return process.env.EXPO_PUBLIC_PAYWALL_ENABLED === 'true';
}

/** Statuses that count as "entitled to use everything." */
const ENTITLING_STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'f_and_f'];

export function isEntitled(status: SubscriptionStatus | null | undefined): boolean {
  if (!status) return false;
  return ENTITLING_STATUSES.includes(status);
}

/**
 * The single home-screen flag the rest of the app reads. True iff the paywall
 * is turned on AND the user isn't entitled. The home screen passes this to
 * downstream features; today it's always false (paywall off), so nothing
 * actually gates yet — see PRD.
 */
export function paywallActive(sub: MySubscription | null): boolean {
  if (!isPaywallEnabled()) return false;
  return !isEntitled(sub?.status);
}

// ---- Writes ----------------------------------------------------------------

/**
 * Calls the `mark_f_and_f` RPC. Returns:
 *  - true  if the user is now (or was already) in the f_and_f tier
 *  - false if the RPC refused because they're already a paying user
 *
 * Throws a BillingError on transport/permission errors.
 */
export async function markAsFriendsAndFamily(): Promise<boolean> {
  const { data, error } = await supabase.rpc('mark_f_and_f');
  if (error) throw new BillingError(error.message, error);
  return Boolean(data);
}

/**
 * Starts a Stripe Checkout flow. On web, navigates the current tab to the
 * Stripe Checkout URL (Stripe redirects back to /billing?ok=1 on success).
 * On native, opens the URL in the system browser (which on iOS uses SFSafariView).
 */
export async function startCheckout(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    url?: string;
    error?: string;
  }>('stripe_create_checkout', { body: {} });
  if (error) throw new BillingError(error.message, error);
  if (!data?.ok || !data.url) {
    throw new BillingError(data?.error || 'Could not start checkout.');
  }
  await openExternalUrl(data.url);
}

/**
 * Opens the Stripe Billing Portal. Requires the user to already have a
 * stripe_customer_id (i.e. they've been through checkout at least once).
 */
export async function openCustomerPortal(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    url?: string;
    error?: string;
  }>('stripe_create_portal', { body: {} });
  if (error) throw new BillingError(error.message, error);
  if (!data?.ok || !data.url) {
    throw new BillingError(data?.error || 'Could not open the billing portal.');
  }
  await openExternalUrl(data.url);
}

// ---- Helpers ---------------------------------------------------------------

async function openExternalUrl(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.location.href = url;
      return;
    }
  }
  await Linking.openURL(url);
}

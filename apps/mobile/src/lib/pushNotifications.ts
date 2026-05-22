/**
 * Web push notifications — subscription + permission helpers.
 *
 * Web-only. Native iOS/Android push runs through Expo Notifications and is a
 * separate code path; everything in this file is `Platform.OS === 'web'` only.
 *
 * The flow:
 *   1. isPushSupported() — feature-detect ServiceWorker + PushManager +
 *      Notification on the current platform.
 *   2. getPermissionState() — 'default' | 'granted' | 'denied' | 'unsupported'.
 *   3. subscribeToPush() — calls Notification.requestPermission() if needed,
 *      registers the service worker subscription against our VAPID public key,
 *      and upserts the (endpoint, p256dh, auth) tuple into the
 *      public.push_subscriptions table in Supabase.
 *   4. unsubscribeFromPush() — removes the local subscription and deletes the
 *      row from Supabase.
 *
 * iOS 16.4+ requirement: web push on Safari only works for PWAs the user has
 * added to their home screen. We don't gate on that in code — Safari throws
 * naturally if you try to subscribe from a normal tab — but the UI layer
 * (install.tsx + PushPermissionModal) coaches the user to install first.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function isPushSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermissionState(): PermissionState {
  if (!isPushSupported()) return 'unsupported';
  const perm = window.Notification?.permission;
  if (perm === 'granted' || perm === 'denied' || perm === 'default') {
    return perm;
  }
  return 'unsupported';
}

/**
 * True iff this page is being rendered as an installed PWA (standalone). On
 * iOS this is the requirement for push to work at all.
 */
export function isStandalonePwa(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(display-mode: standalone)');
  if (mql && mql.matches) return true;
  // iOS legacy
  const navStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return navStandalone === true;
}

/** Best-effort platform classification for the install screen + soft-ask copy. */
export function detectInstallPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
  if (Platform.OS !== 'web') return 'unknown';
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  // iPad on iPadOS 13+ reports "MacIntel" platform with touch — catch via maxTouchPoints.
  const isIPadOS =
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isIOS = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream;
  if (isIOS || isIPadOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Convert a base64url-encoded VAPID public key to the Uint8Array form
 * `pushManager.subscribe({ applicationServerKey })` expects.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

async function getOrAwaitRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  // Prefer the existing registration; fall back to ready (handles "first load").
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/**
 * Subscribe the current browser to push and upsert the subscription server-side.
 * Returns true if a subscription is now active for this user, false otherwise.
 *
 * Caller is expected to have already shown the soft-ask UI; this function
 * calls Notification.requestPermission() if the state is still 'default', so
 * a system prompt may appear immediately.
 */
export async function subscribeToPush(): Promise<{
  ok: boolean;
  reason?: 'unsupported' | 'denied' | 'no-vapid' | 'no-user' | 'no-registration' | 'error';
  error?: string;
}> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid' };

  // 1. Ask permission if we haven't already.
  let perm = window.Notification.permission;
  if (perm === 'default') {
    try {
      perm = await window.Notification.requestPermission();
    } catch (e) {
      return { ok: false, reason: 'error', error: (e as Error)?.message };
    }
  }
  if (perm !== 'granted') return { ok: false, reason: 'denied' };

  // 2. Register the SW (may already be registered by +html.tsx bootstrap).
  let registration = await getOrAwaitRegistration();
  if (!registration) {
    try {
      registration = await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      return { ok: false, reason: 'no-registration', error: (e as Error)?.message };
    }
  }

  // 3. Subscribe. Reuse an existing subscription if its applicationServerKey
  // matches; otherwise tear it down and re-subscribe with the current key.
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    // We don't have a great way to compare server keys cross-browser; safest
    // is to keep the existing subscription and just upsert it server-side.
  } else {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (e) {
      return { ok: false, reason: 'error', error: (e as Error)?.message };
    }
  }

  // 4. Persist to Supabase. Auth must be ready — this is called from a UI
  // gesture inside the signed-in app, so getUser() should return a user.
  const { data: userResp } = await supabase.auth.getUser();
  const userId = userResp?.user?.id;
  if (!userId) return { ok: false, reason: 'no-user' };

  const p256dh = arrayBufferToBase64(subscription.getKey('p256dh'));
  const auth = arrayBufferToBase64(subscription.getKey('auth'));
  const endpoint = subscription.endpoint;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

  const { error: upsertErr } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );

  if (upsertErr) {
    return { ok: false, reason: 'error', error: upsertErr.message };
  }

  return { ok: true };
}

/**
 * Tear down the push subscription for this browser and delete the row from
 * Supabase. Safe to call even if no subscription exists.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await getOrAwaitRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } catch {
    // ignore
  }

  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch {
    // ignore
  }
}

// ---- Soft-ask dismissal memory ---------------------------------------------
// We don't want to nag a user who tapped "Maybe later". Remember the
// dismissal locally for 7 days so the modal stays quiet.

const DISMISS_KEY = 'famlink.push.softAskDismissedAt';
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function markSoftAskDismissed(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function wasSoftAskRecentlyDismissed(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_WINDOW_MS;
  } catch {
    return false;
  }
}

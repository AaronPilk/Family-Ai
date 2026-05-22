/**
 * Pending invite token storage.
 *
 * When a signed-out user lands on /join/<token>, we stash the token here and
 * route them to sign-up. After sign-up (and email confirmation) we read it
 * back and call `claim_family_invite` so they land inside the host's circle.
 *
 * Web: localStorage. Native: SecureStore. Both are wrapped in try/catch so a
 * disabled or locked store never blocks the sign-up flow.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'pendingInviteToken';

export async function setPendingInviteToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(KEY, token);
      }
      return;
    }
    await SecureStore.setItemAsync(KEY, token);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[pendingInvite] set failed:', err);
  }
}

export async function getPendingInviteToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(KEY);
    }
    return await SecureStore.getItemAsync(KEY);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[pendingInvite] get failed:', err);
    return null;
  }
}

export async function clearPendingInviteToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(KEY);
      }
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[pendingInvite] clear failed:', err);
  }
}

/**
 * Synchronous read for screen render. On web we can read localStorage
 * synchronously; on native we can't, so we return null and rely on a follow-up
 * useEffect with `getPendingInviteToken()` for the actual value.
 */
export function getPendingInviteTokenSync(): string | null {
  if (Platform.OS !== 'web') return null;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

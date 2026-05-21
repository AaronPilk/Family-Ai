/**
 * Real Supabase client for the FamLink mobile + web app.
 *
 * Session persistence is platform-aware:
 *  - Native (iOS / Android): expo-secure-store (Keychain / Keystore) with
 *    chunking because some Supabase JWTs exceed SecureStore's 2 KB cap.
 *  - Web: window.localStorage. Browsers don't have a hardware-backed keychain;
 *    the Supabase anon key + HTTPS provide the security boundary.
 *
 * Per docs/SECURITY-REVIEW.md M6: we ONLY use the anon key here. The
 * service-role key never lands in the client bundle.
 */

import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

// ---- Env validation --------------------------------------------------------

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. ' +
      'Add them to apps/mobile/.env and restart Metro. Auth will not work until you do.',
  );
}

// ---- Storage adapters ------------------------------------------------------

interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// SecureStore caps values at 2 KB. Chunk longer values.
const CHUNK_SIZE = 1800;

const secureStoreAdapter: StorageAdapter = {
  async getItem(key) {
    try {
      const head = await SecureStore.getItemAsync(key);
      if (!head) return null;
      const match = head.match(/^__chunked__:(\d+)$/);
      if (!match) return head;
      const count = Number(match[1]);
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(`${key}.${i}`);
        if (part == null) return null;
        parts.push(part);
      }
      return parts.join('');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[supabase] SecureStore.getItem failed:', err);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }
      await SecureStore.setItemAsync(key, `__chunked__:${chunks.length}`);
      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]!);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[supabase] SecureStore.setItem failed:', err);
    }
  },

  async removeItem(key) {
    try {
      const head = await SecureStore.getItemAsync(key);
      const match = head?.match(/^__chunked__:(\d+)$/);
      if (match) {
        const count = Number(match[1]);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}.${i}`);
        }
      }
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[supabase] SecureStore.removeItem failed:', err);
    }
  },
};

const localStorageAdapter: StorageAdapter = {
  async getItem(key) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[supabase] localStorage.getItem failed:', err);
      return null;
    }
  },
  async setItem(key, value) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(key, value);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[supabase] localStorage.setItem failed:', err);
    }
  },
  async removeItem(key) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(key);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[supabase] localStorage.removeItem failed:', err);
    }
  },
};

const storage: StorageAdapter = Platform.OS === 'web' ? localStorageAdapter : secureStoreAdapter;

// ---- The client ------------------------------------------------------------

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL ?? 'https://missing-env.invalid',
  SUPABASE_ANON_KEY ?? 'missing-env',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      // detectSessionInUrl on web only — Supabase handles magic-link redirects
      // via URL hash fragments when the user clicks the email link.
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

// ---- AppState-driven token refresh (native only) ---------------------------
// On native, Supabase docs say to start/stop auto-refresh on app foreground.
// On web, browser tab lifecycle handles this implicitly.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

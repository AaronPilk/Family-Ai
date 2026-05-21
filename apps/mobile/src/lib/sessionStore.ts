import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Global session state. Subscribes to Supabase's onAuthStateChange so every
 * surface in the app sees the same source of truth.
 *
 * The store is initialized once at app bootstrap (in _layout.tsx); after that
 * any component can read it via `useSession()`.
 */

interface SessionState {
  /** undefined = still loading initial session; null = signed out; Session = signed in. */
  session: Session | null | undefined;
  user: User | null;
  setSession: (s: Session | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: undefined,
  user: null,
  setSession: (s) => set({ session: s, user: s?.user ?? null }),
}));

let initialized = false;
let unsubscribeAuth: (() => void) | null = null;

/**
 * One-time bootstrap. Call from the root layout. Reads the persisted session
 * (if any) and wires the onAuthStateChange listener.
 */
export function initSession() {
  if (initialized) return;
  initialized = true;

  supabase.auth.getSession().then(({ data }) => {
    useSessionStore.getState().setSession(data.session ?? null);
  });

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useSessionStore.getState().setSession(session ?? null);
  });
  unsubscribeAuth = () => data.subscription.unsubscribe();
}

/**
 * Test-only / hot-reload teardown.
 */
export function disposeSession() {
  unsubscribeAuth?.();
  unsubscribeAuth = null;
  initialized = false;
}

// ---- Convenience hooks -----------------------------------------------------

export function useSession(): Session | null | undefined {
  return useSessionStore((s) => s.session);
}

export function useUser(): User | null {
  return useSessionStore((s) => s.user);
}

/**
 * Returns one of: 'loading' | 'signed-out' | 'signed-in'. Useful for top-level
 * routing in _layout.tsx where the three states want different behavior.
 */
export function useAuthStatus(): 'loading' | 'signed-out' | 'signed-in' {
  const session = useSession();
  if (session === undefined) return 'loading';
  if (session === null) return 'signed-out';
  return 'signed-in';
}

/**
 * Drop-in replacement for the old `ME` constant — returns the current user's
 * id, or null if signed out. Code that mutates data should fail loudly if
 * called while signed out.
 */
export function useMyUserId(): string | null {
  const user = useUser();
  return user?.id ?? null;
}

/**
 * For components that absolutely require a signed-in user; throws if not.
 * Safe to call inside any screen rendered under the (tabs) gate.
 */
export function useMyUserIdOrThrow(): string {
  const id = useMyUserId();
  if (!id) {
    throw new Error('useMyUserIdOrThrow called from a screen that is not session-gated');
  }
  return id;
}

// ---- Helpers for screens ---------------------------------------------------

export async function signOut() {
  await supabase.auth.signOut();
  // onAuthStateChange will clear the store.
}

/**
 * Hook to await session bootstrap. Most consumers just read useAuthStatus()
 * instead; this is here for explicit splash-screen waits.
 */
export function useAwaitedSession(): Session | null {
  const session = useSession();
  const [resolved, setResolved] = useState<Session | null>(null);
  useEffect(() => {
    if (session !== undefined) setResolved(session);
  }, [session]);
  return resolved;
}

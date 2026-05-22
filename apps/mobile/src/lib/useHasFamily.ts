/**
 * useHasFamily — does the signed-in user have anyone else in their primary
 * family circle yet? Drives demo-mode gating on every tab.
 *
 * Returns `hasFamily = true` iff the user's primary circle has more than one
 * active member (count > 1, removed_at IS NULL). When false, screens render
 * the demo dataset under a sticky DEMO banner. When true, screens render real
 * Supabase data (which will initially be empty until the user creates events,
 * answers questions, etc.).
 *
 * The hook caches state in a zustand store and refetches:
 *  - on session change (sign in / sign out)
 *  - whenever a screen mounts (cheap; one query)
 *  - on demand via `refresh()` (e.g. after the user mints an invite link or
 *    visits the Family tab)
 *
 * Fires a one-time celebration toast when `hasFamily` flips false → true.
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import { supabase } from './supabase';
import { useSessionStore } from './sessionStore';

interface HasFamilyState {
  hasFamily: boolean;
  loading: boolean;
  count: number;
  error: string | null;
  /** UUID of the user this state was computed for; used to invalidate on sign-in switch. */
  forUserId: string | null;
  /** Primary circle id once known. Used to scope the realtime subscription. */
  circleId: string | null;
  /** True once we've fired the "you're connected" toast for this session. */
  celebrated: boolean;
  setState: (next: Partial<HasFamilyState>) => void;
  markCelebrated: () => void;
}

const useHasFamilyStore = create<HasFamilyState>((set) => ({
  hasFamily: false,
  loading: true,
  count: 0,
  error: null,
  forUserId: null,
  circleId: null,
  celebrated: false,
  setState: (next) => set((s) => ({ ...s, ...next })),
  markCelebrated: () => set({ celebrated: true }),
}));

let inflight: Promise<void> | null = null;

/**
 * Realtime subscription handle for the active circle. Recreated on
 * sign-in / circle change so we never leak channels.
 */
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let realtimeForCircleId: string | null = null;

function teardownRealtime() {
  if (realtimeChannel) {
    try {
      supabase.removeChannel(realtimeChannel);
    } catch {
      /* noop */
    }
    realtimeChannel = null;
    realtimeForCircleId = null;
  }
}

function ensureRealtime(circleId: string | null, userId: string | null) {
  if (!circleId || !userId) {
    teardownRealtime();
    return;
  }
  if (realtimeForCircleId === circleId) return;
  teardownRealtime();
  realtimeForCircleId = circleId;
  realtimeChannel = supabase
    .channel(`family-memberships-${circleId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'family_memberships',
        filter: `circle_id=eq.${circleId}`,
      },
      () => {
        // Refetch on any membership change in this circle — joins, leaves,
        // soft-removes. Cheap (count query); the gate flips when count > 1.
        refreshHasFamily(userId);
      },
    )
    .subscribe();
}

/**
 * Fetch the user's primary circle membership count. Single-flight: if another
 * caller already kicked one off, we await the same promise.
 */
export async function refreshHasFamily(userId: string | null): Promise<void> {
  if (!userId) {
    teardownRealtime();
    useHasFamilyStore.setState({
      hasFamily: false,
      loading: false,
      count: 0,
      error: null,
      forUserId: null,
      circleId: null,
      celebrated: false,
    });
    return;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      // 1. Find the user's primary circle (earliest joined membership).
      const { data: memRows, error: memErr } = await supabase
        .from('family_memberships')
        .select('circle_id, joined_at')
        .eq('user_id', userId)
        .is('removed_at', null)
        .order('joined_at', { ascending: true })
        .limit(1);
      if (memErr) throw memErr;
      const circleId = memRows?.[0]?.circle_id as string | undefined;
      if (!circleId) {
        teardownRealtime();
        useHasFamilyStore.setState({
          hasFamily: false,
          loading: false,
          count: 0,
          error: null,
          forUserId: userId,
          circleId: null,
        });
        return;
      }

      // 2. Count active members in that circle, excluding the signed-in user.
      // The gate is "is someone OTHER than me in this circle?" — counting the
      // user themselves and gating on `> 1` worked but is less explicit and
      // breaks the day we let users belong to two circles. Filter directly.
      const { count, error: countErr } = await supabase
        .from('family_memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('circle_id', circleId)
        .neq('user_id', userId)
        .is('removed_at', null);
      if (countErr) throw countErr;

      const others = count ?? 0;
      const hasFamily = others > 0;

      const prev = useHasFamilyStore.getState();
      useHasFamilyStore.setState({
        hasFamily,
        loading: false,
        // `count` is total active members in the circle (self + others) for
        // continuity with previous callers; flip to `others` if any consumer
        // cares specifically about non-self.
        count: others + 1,
        error: null,
        forUserId: userId,
        circleId,
        // Reset celebration flag if we switched users.
        celebrated: prev.forUserId === userId ? prev.celebrated : false,
      });
      // Wire (or rewire) the realtime subscription to this circle so a join
      // anywhere else flips the gate immediately.
      ensureRealtime(circleId, userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not check family status.';
      useHasFamilyStore.setState({
        loading: false,
        error: msg,
        forUserId: userId,
      });
      // eslint-disable-next-line no-console
      console.warn('[useHasFamily] refresh failed:', e);
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * React to auth-state changes globally — one subscription for the whole app.
 * Resets state when the user signs out, refetches when they sign in.
 */
let authSubscribed = false;
function subscribeOnce() {
  if (authSubscribed) return;
  authSubscribed = true;
  // Initial fetch for whoever's already signed in.
  const initial = useSessionStore.getState().user?.id ?? null;
  refreshHasFamily(initial);

  useSessionStore.subscribe((state, prev) => {
    const nextId = state.user?.id ?? null;
    const prevId = prev.user?.id ?? null;
    if (nextId !== prevId) {
      refreshHasFamily(nextId);
    }
  });
}

export interface UseHasFamilyResult {
  hasFamily: boolean;
  loading: boolean;
  count: number;
  error: string | null;
  /** Fire to recheck membership; safe to call after invite mint or family-tab focus. */
  refresh: () => Promise<void>;
  /** True the first render after the demo→real flip; consumers fire a toast then call clear. */
  justConnected: boolean;
  /** Mark the celebration as consumed so it doesn't fire again. */
  clearCelebration: () => void;
}

export function useHasFamily(): UseHasFamilyResult {
  subscribeOnce();
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const state = useHasFamilyStore();

  // On mount (and whenever the user id changes), refetch. Cheap (count query).
  useEffect(() => {
    refreshHasFamily(userId);
  }, [userId]);

  const justConnected = state.hasFamily && !state.celebrated && state.forUserId === userId;

  return {
    hasFamily: state.hasFamily,
    loading: state.loading,
    count: state.count,
    error: state.error,
    refresh: () => refreshHasFamily(userId),
    justConnected,
    clearCelebration: () => useHasFamilyStore.getState().markCelebrated(),
  };
}

/**
 * useIsDevUser — boolean gate for admin-only / dev-only controls.
 *
 * Returns true iff the signed-in user's email is in the hardcoded allowlist
 * OR their `profiles.is_dev` column is true. The DB column lets us add new
 * devs without an app release; the hardcoded list is a fallback so Aaron is
 * never locked out of dev controls (e.g. before the migration deploys).
 *
 * Used to wrap "Reset demo", role toggles, blended-family demo, and similar
 * in-app dev affordances. Regular users see a clean UI.
 */

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useSessionStore } from './sessionStore';

const HARDCODED_ALLOWLIST: ReadonlyArray<string> = ['aaron@skyway.media'];

interface State {
  isDev: boolean;
  loading: boolean;
}

/**
 * Cache the lookup per-session: profiles.is_dev rarely changes, and we don't
 * want every (tabs) mount firing a query.
 */
const cache = new Map<string, boolean>();

export function useIsDevUser(): boolean {
  const user = useSessionStore((s) => s.user);
  const email = user?.email ?? null;
  const userId = user?.id ?? null;

  const hardcoded = !!email && HARDCODED_ALLOWLIST.includes(email.toLowerCase());

  const [state, setState] = useState<State>({
    isDev: hardcoded || (userId ? cache.get(userId) === true : false),
    loading: !!userId && !hardcoded && !cache.has(userId),
  });

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setState({ isDev: false, loading: false });
      return;
    }
    if (hardcoded) {
      setState({ isDev: true, loading: false });
      return;
    }
    if (cache.has(userId)) {
      setState({ isDev: cache.get(userId) === true, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_dev')
          .eq('user_id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          // Column may not exist yet on stale DBs; treat as non-dev.
          // eslint-disable-next-line no-console
          console.warn('[useIsDevUser] profiles.is_dev lookup failed:', error.message);
          cache.set(userId, false);
          setState({ isDev: false, loading: false });
          return;
        }
        const isDev = !!(data && (data as { is_dev?: boolean }).is_dev);
        cache.set(userId, isDev);
        setState({ isDev, loading: false });
      } catch (e) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn('[useIsDevUser] lookup threw:', e);
        cache.set(userId, false);
        setState({ isDev: false, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, hardcoded]);

  return state.isDev;
}

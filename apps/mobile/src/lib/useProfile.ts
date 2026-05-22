import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { supabase } from './supabase';
import { useMyUserId } from './sessionStore';
import {
  useBranchStore,
  dbRoleToClient,
  type DbRole,
  type Gender,
  type UserRole,
} from './branchStore';

/**
 * Profile data layer.
 *
 * We read `public.profiles` exactly once per signed-in session and cache it
 * in a small zustand store so every screen — the onboarding gate at root,
 * the Ask tab, the Family tab avatar chip, the /profile editor — reads the
 * same row without re-fetching. Mutations go through `updateProfile()`,
 * which writes to Supabase and then patches the cache so the UI updates
 * without waiting for a refetch.
 *
 * Fields mirrored here are the ones the onboarding + profile-editing
 * surfaces need. Add more as features want them.
 */

export interface Profile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  birthDate: string | null; // ISO date YYYY-MM-DD
  tagline: string | null;
  role: DbRole | null;
  gender: Gender | null;
  onboardingCompleted: boolean;
}

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  loadedForUserId: string | null;
  error: string | null;
  setProfile: (p: Profile | null) => void;
  patchProfile: (patch: Partial<Profile>) => void;
  setLoading: (b: boolean) => void;
  setError: (m: string | null) => void;
  setLoadedForUserId: (id: string | null) => void;
}

const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: false,
  loadedForUserId: null,
  error: null,
  setProfile: (p) => set({ profile: p }),
  patchProfile: (patch) =>
    set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : s)),
  setLoading: (b) => set({ loading: b }),
  setError: (m) => set({ error: m }),
  setLoadedForUserId: (id) => set({ loadedForUserId: id }),
}));

function rowToProfile(row: Record<string, unknown>, userId: string): Profile {
  return {
    userId,
    displayName: (row.display_name as string) ?? '',
    avatarUrl: (row.avatar_url as string | null) ?? null,
    birthDate: (row.birth_date as string | null) ?? null,
    tagline: (row.tagline as string | null) ?? null,
    role: (row.role as DbRole | null) ?? null,
    gender: (row.gender as Gender | null) ?? null,
    onboardingCompleted: Boolean(row.onboarding_completed),
  };
}

/**
 * Loads the profile row for the current signed-in user and keeps the
 * branchStore userRole in sync with profiles.role. Call once near the top
 * of any screen that needs the profile; multiple callers share the cache.
 */
export function useProfile(): {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const userId = useMyUserId();
  const profile = useProfileStore((s) => s.profile);
  const loading = useProfileStore((s) => s.loading);
  const loadedForUserId = useProfileStore((s) => s.loadedForUserId);
  const error = useProfileStore((s) => s.error);

  const fetchProfile = useCallback(async (uid: string) => {
    const store = useProfileStore.getState();
    store.setLoading(true);
    store.setError(null);
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select(
          'user_id, display_name, avatar_url, birth_date, tagline, role, gender, onboarding_completed',
        )
        .eq('user_id', uid)
        .maybeSingle();
      if (err) {
        store.setError(err.message);
        store.setProfile(null);
      } else if (data) {
        const p = rowToProfile(data, uid);
        store.setProfile(p);
        // Mirror persisted role into the client zustand so Home/Ask hero
        // pick the right mode without an extra round trip.
        useBranchStore.getState().setUserRole(dbRoleToClient(p.role));
      } else {
        // No row yet — the signup trigger should have inserted one. Treat
        // as "needs onboarding" so the gate routes them there anyway.
        store.setProfile(null);
      }
    } catch (e) {
      store.setError(e instanceof Error ? e.message : String(e));
      store.setProfile(null);
    } finally {
      store.setLoading(false);
      store.setLoadedForUserId(uid);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      // Signed out — clear cache.
      const store = useProfileStore.getState();
      store.setProfile(null);
      store.setLoadedForUserId(null);
      store.setError(null);
      return;
    }
    if (loadedForUserId === userId) return;
    void fetchProfile(userId);
  }, [userId, loadedForUserId, fetchProfile]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await fetchProfile(userId);
  }, [userId, fetchProfile]);

  return { profile, loading, error, refresh };
}

/**
 * Update a subset of profile columns. Writes to Supabase, then patches the
 * cache (and the branchStore role) on success so screens render the new
 * value immediately. Returns the new profile or throws on error.
 */
export async function updateProfile(
  userId: string,
  patch: Partial<{
    displayName: string;
    birthDate: string | null;
    tagline: string | null;
    role: DbRole | null;
    gender: Gender | null;
    onboardingCompleted: boolean;
    avatarUrl: string | null;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.birthDate !== undefined) row.birth_date = patch.birthDate;
  if (patch.tagline !== undefined) row.tagline = patch.tagline;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.gender !== undefined) row.gender = patch.gender;
  if (patch.onboardingCompleted !== undefined)
    row.onboarding_completed = patch.onboardingCompleted;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;

  if (Object.keys(row).length === 0) return;

  const { error } = await supabase
    .from('profiles')
    .update(row)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  // Patch the cache so subsequent useProfile() callers see the new value.
  const cachePatch: Partial<Profile> = {};
  if (patch.displayName !== undefined) cachePatch.displayName = patch.displayName;
  if (patch.birthDate !== undefined) cachePatch.birthDate = patch.birthDate;
  if (patch.tagline !== undefined) cachePatch.tagline = patch.tagline;
  if (patch.role !== undefined) cachePatch.role = patch.role;
  if (patch.gender !== undefined) cachePatch.gender = patch.gender;
  if (patch.onboardingCompleted !== undefined)
    cachePatch.onboardingCompleted = patch.onboardingCompleted;
  if (patch.avatarUrl !== undefined) cachePatch.avatarUrl = patch.avatarUrl;
  useProfileStore.getState().patchProfile(cachePatch);

  if (patch.role !== undefined) {
    useBranchStore.getState().setUserRole(dbRoleToClient(patch.role));
  }
}

/** Returns the initials for an avatar from a display name. */
export function initialsOf(displayName: string | null | undefined): string {
  if (!displayName) return '·';
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? '') + (parts[parts.length - 1]![0] ?? '')).toUpperCase();
}

/** Extract a usable first name from a display name. */
export function firstNameOf(displayName: string | null | undefined): string {
  if (!displayName) return 'there';
  const first = displayName.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : 'there';
}

/** Re-export for callers that just want the client-side role. */
export type { UserRole };

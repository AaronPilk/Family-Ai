import { create } from 'zustand';
import { BRANCHES, type BranchId, type Branch, type MemberId } from './mockData';

/**
 * Selection model:
 *  - When the user has 1 branch: `selection` = that branch's id; no "all" needed.
 *  - When the user has 2+: `selection` can be 'all' OR a specific BranchId.
 *  - 'all' is a virtual scope that aggregates content across visibleBranchIds.
 */
export type BranchSelection = BranchId | 'all';

/**
 * User's generational role within the family. Drives which Home hero shows:
 *  - 'elder' (parent/grandparent) sees the "Answer today's prompt" card —
 *    they're the ones with stories to tell.
 *  - 'younger' (child/grandchild) sees the "Ask someone today" card — they're
 *    the ones doing the asking.
 *  - 'middle' (both — parent who still has living parents) defaults to Ask
 *    mode since they're usually the connective tissue, but the Ask tab lets
 *    them flip to Answer mode for their own kids.
 *
 * The DB stores this on `profiles.role` as 'elder' | 'middle' | 'child'
 * (see migration 20260522000009). On the client we keep the historical
 * 'younger' alias for backwards compatibility with screens written before
 * the three-way split. `dbRoleToClient` / `clientRoleToDb` translate.
 */
export type UserRole = 'elder' | 'middle' | 'younger';

/**
 * Persisted role values, as stored on profiles.role.
 *
 * The new vocabulary (parent/grandparent/child/grandchild/middle) is what
 * onboarding writes going forward. The legacy 'elder' value is kept so older
 * rows still type-check; the mapper below collapses it into 'elder' on the
 * client (same Answer-mode behavior as 'parent' or 'grandparent').
 */
export type DbRole =
  | 'parent'
  | 'grandparent'
  | 'child'
  | 'grandchild'
  | 'middle'
  | 'elder'; // legacy

/**
 * User-declared gender. Drives prompt personalization in the Questions Engine
 * ("Mom, tell me about…" vs "Dad, tell me about…"). Optional — null means
 * the user didn't specify, and prompts fall back to neutral phrasing.
 */
export type Gender = 'female' | 'male' | 'nonbinary' | 'prefer_not';

export function dbRoleToClient(r: DbRole | null | undefined): UserRole {
  if (r === 'parent' || r === 'grandparent' || r === 'elder') return 'elder';
  if (r === 'middle') return 'middle';
  // null, 'child', or 'grandchild' → 'younger' (the asker side).
  return 'younger';
}

/**
 * Inverse of dbRoleToClient. Since UserRole is a coarse bucket, this emits
 * the bucket-default DbRole. Callers who already know whether the user is
 * specifically a parent vs grandparent should pass that value through
 * `updateProfile({ role })` directly instead of routing through UserRole.
 */
export function clientRoleToDb(r: UserRole): DbRole {
  if (r === 'elder') return 'parent';
  if (r === 'middle') return 'middle';
  return 'child';
}

/** True if the role belongs to the storyteller side (Answer mode). */
export function isAnswererRole(r: DbRole | null | undefined): boolean {
  return r === 'parent' || r === 'grandparent' || r === 'elder';
}

/** True if the role belongs to the asker side. */
export function isAskerRole(r: DbRole | null | undefined): boolean {
  return r === 'child' || r === 'grandchild';
}

interface BranchState {
  selection: BranchSelection;
  visibleBranchIds: BranchId[];
  userRole: UserRole;

  setSelection: (s: BranchSelection) => void;
  cycle: () => void;

  enableBlendedDemo: () => void;
  disableBlendedDemo: () => void;

  setUserRole: (r: UserRole) => void;
}

export const useBranchStore = create<BranchState>((set, get) => ({
  selection: 'pilks',
  visibleBranchIds: ['pilks'],
  // Aaron is the child/asker in the Pilks family — default to 'younger'.
  userRole: 'younger',

  setSelection: (s) => set({ selection: s }),
  cycle: () => {
    const visible = get().visibleBranchIds;
    if (visible.length < 2) return;
    // Order: all → first branch → second branch → all
    const ring: BranchSelection[] = ['all', ...visible];
    const i = ring.indexOf(get().selection);
    set({ selection: ring[(i + 1) % ring.length]! });
  },

  enableBlendedDemo: () => set({ visibleBranchIds: ['pilks', 'stepfamily'], selection: 'all' }),
  disableBlendedDemo: () => set({ visibleBranchIds: ['pilks'], selection: 'pilks' }),

  setUserRole: (r) => set({ userRole: r }),
}));

export function useUserRole(): UserRole {
  return useBranchStore((s) => s.userRole);
}

/* ---------- hooks ---------- */

export function useSelection(): BranchSelection {
  return useBranchStore((s) => s.selection);
}

export function useVisibleBranches(): Branch[] {
  const ids = useBranchStore((s) => s.visibleBranchIds);
  return ids.map((id) => BRANCHES[id]);
}

export function useIsMultiBranch(): boolean {
  return useBranchStore((s) => s.visibleBranchIds.length > 1);
}

/** Which branch ids should the current selection include? */
export function useScopedBranchIds(): BranchId[] {
  const sel = useBranchStore((s) => s.selection);
  const visible = useBranchStore((s) => s.visibleBranchIds);
  return sel === 'all' ? visible : [sel];
}

/**
 * View of the active scope. Discriminated union — `all` is structurally
 * distinct from a real `Branch` so callers can't silently treat the synthetic
 * "All my family" scope as a writable branch (Codex H-M2).
 *
 * Use `useCurrentBranch()` for display (label/color/count).
 * Use `useWritableBranchId()` if you need a real branch id to write into;
 * it returns null when the user is in "all" mode and the caller MUST pick.
 */
export type CurrentBranchView =
  | {
      kind: 'single';
      branchId: BranchId;
      shortName: string;
      name: string;
      color: string;
      memberIds: MemberId[];
      memoryCount: number;
    }
  | {
      kind: 'all';
      branchIds: BranchId[];
      shortName: 'All my family';
      name: 'All my family';
      color: string;
      memberIds: MemberId[];
      memoryCount: number;
    };

export function useCurrentBranch(): CurrentBranchView {
  const sel = useBranchStore((s) => s.selection);
  const visible = useBranchStore((s) => s.visibleBranchIds);
  if (sel === 'all') {
    return {
      kind: 'all',
      branchIds: visible,
      shortName: 'All my family',
      name: 'All my family',
      color: '#7A4A8C',
      memberIds: Array.from(new Set(visible.flatMap((id) => BRANCHES[id].memberIds))),
      memoryCount: visible.reduce((sum, id) => sum + BRANCHES[id].memoryCount, 0),
    };
  }
  const b = BRANCHES[sel];
  return {
    kind: 'single',
    branchId: sel,
    shortName: b.shortName,
    name: b.name,
    color: b.color,
    memberIds: b.memberIds,
    memoryCount: b.memoryCount,
  };
}

/**
 * Returns the BranchId you can write into; null when the user is in the
 * synthetic "all" scope. Forms that create rows must check this and force a
 * picker before submit.
 */
export function useWritableBranchId(): BranchId | null {
  const view = useCurrentBranch();
  return view.kind === 'single' ? view.branchId : null;
}

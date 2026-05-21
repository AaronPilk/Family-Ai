import { create } from 'zustand';
import { BRANCHES, type BranchId, type Branch, type MemberId } from './mockData';

/**
 * Selection model:
 *  - When the user has 1 branch: `selection` = that branch's id; no "all" needed.
 *  - When the user has 2+: `selection` can be 'all' OR a specific BranchId.
 *  - 'all' is a virtual scope that aggregates content across visibleBranchIds.
 */
export type BranchSelection = BranchId | 'all';

interface BranchState {
  selection: BranchSelection;
  visibleBranchIds: BranchId[];

  setSelection: (s: BranchSelection) => void;
  cycle: () => void;

  enableBlendedDemo: () => void;
  disableBlendedDemo: () => void;
}

export const useBranchStore = create<BranchState>((set, get) => ({
  selection: 'pilks',
  visibleBranchIds: ['pilks'],

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
}));

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

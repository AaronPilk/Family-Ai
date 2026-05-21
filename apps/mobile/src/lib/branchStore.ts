import { create } from 'zustand';
import { BRANCHES, type BranchId, type Branch } from './mockData';

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

  enableBlendedDemo: () =>
    set({ visibleBranchIds: ['pilks', 'stepfamily'], selection: 'all' }),
  disableBlendedDemo: () =>
    set({ visibleBranchIds: ['pilks'], selection: 'pilks' }),
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

/** The active branch object (or a synthetic one for the "all" view) */
export function useCurrentBranch(): Branch {
  const sel = useBranchStore((s) => s.selection);
  const visible = useBranchStore((s) => s.visibleBranchIds);
  if (sel === 'all') {
    return {
      id: 'pilks', // unused
      name: 'All my family',
      shortName: 'All my family',
      memberIds: Array.from(new Set(visible.flatMap((id) => BRANCHES[id].memberIds))),
      color: '#7A4A8C', // muted purple for "all"
      memoryCount: visible.reduce((sum, id) => sum + BRANCHES[id].memoryCount, 0),
    };
  }
  return BRANCHES[sel];
}

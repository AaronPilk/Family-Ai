import { create } from 'zustand';
import { type FamilyMoment, type PollOption, ME } from './mockData';

/**
 * Legacy "moments" store — the older Tahoe/Thanksgiving planning shape that
 * predates the Events surface. Initialized empty in this pass; nothing in the
 * critical-path UI reads it for the family-test rollout, but the type still
 * compiles so the few remaining references (timeline picker, etc.) keep
 * working.
 */
type MomentMap = Record<string, FamilyMoment>;

interface MomentState {
  moments: MomentMap;
  toggleVote: (momentId: string, poll: 'datePoll' | 'locationPoll', optionId: string) => void;
  togglePackingItem: (momentId: string, itemId: string) => void;
  addMoment: (m: FamilyMoment) => void;
  getMoment: (id: string) => FamilyMoment | undefined;
}

export const useMomentStore = create<MomentState>((set, get) => ({
  moments: {},
  toggleVote: (momentId, poll, optionId) =>
    set((s) => {
      const m = s.moments[momentId];
      if (!m) return s;
      const poolKey = poll;
      const pool = (m[poolKey] as PollOption[] | undefined)?.map((opt) => {
        if (opt.id !== optionId) return opt;
        const has = opt.votes.includes(ME);
        return {
          ...opt,
          votes: has ? opt.votes.filter((v) => v !== ME) : [...opt.votes, ME],
        };
      });
      if (!pool) return s;
      return { moments: { ...s.moments, [momentId]: { ...m, [poolKey]: pool } } };
    }),
  addMoment: (m) => set((s) => ({ moments: { ...s.moments, [m.id]: m } })),
  togglePackingItem: (momentId, itemId) =>
    set((s) => {
      const m = s.moments[momentId];
      if (!m?.packingList) return s;
      return {
        moments: {
          ...s.moments,
          [momentId]: {
            ...m,
            packingList: m.packingList.map((p) =>
              p.id === itemId ? { ...p, checked: !p.checked } : p,
            ),
          },
        },
      };
    }),
  getMoment: (id) => get().moments[id],
}));

export function useMoment(id: string): FamilyMoment | undefined {
  return useMomentStore((s) => s.moments[id]);
}

export function useAllMoments(): FamilyMoment[] {
  return useMomentStore((s) => Object.values(s.moments));
}

import { create } from 'zustand';
import { MOMENTS, ME, type FamilyMoment, type PollOption, type PackingItem, type MemberId } from './mockData';

/**
 * Local mutable copy of moments so the demo can react to taps.
 * Keyed by moment id; mirrors the shape in mockData but lets us mutate.
 */
type MomentMap = Record<string, FamilyMoment>;

function clone(m: FamilyMoment): FamilyMoment {
  return {
    ...m,
    datePoll: m.datePoll?.map((o) => ({ ...o, votes: [...o.votes] })),
    locationPoll: m.locationPoll?.map((o) => ({ ...o, votes: [...o.votes] })),
    packingList: m.packingList?.map((p) => ({ ...p })),
    activity: m.activity.map((a) => ({ ...a })),
  };
}

interface MomentState {
  moments: MomentMap;
  toggleVote: (momentId: string, poll: 'datePoll' | 'locationPoll', optionId: string) => void;
  togglePackingItem: (momentId: string, itemId: string) => void;
  addMoment: (m: FamilyMoment) => void;
  getMoment: (id: string) => FamilyMoment | undefined;
}

const initialMap: MomentMap = Object.fromEntries(MOMENTS.map((m) => [m.id, clone(m)]));

export const useMomentStore = create<MomentState>((set, get) => ({
  moments: initialMap,
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
      return {
        moments: { ...s.moments, [momentId]: { ...m, [poolKey]: pool } },
      };
    }),
  addMoment: (m) =>
    set((s) => ({ moments: { ...s.moments, [m.id]: clone(m) } })),
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

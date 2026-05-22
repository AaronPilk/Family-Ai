/**
 * Session-scoped state for the answering surface.
 *
 * `skippedIds` keeps the same question from being re-served within one
 * session after the user taps "Skip for now". `celebratedMilestones`
 * remembers which streak banners (10/25/50/100) have already been shown,
 * so a user who answers question #25 only sees the celebration once,
 * not on every subsequent screen mount.
 *
 * All state is in-memory only. Hot-reload clears it; that's intentional.
 */

import { create } from 'zustand';

interface AnswerSessionState {
  skippedIds: string[];
  celebratedMilestones: number[];
  skip: (id: string) => void;
  markCelebrated: (n: number) => void;
  reset: () => void;
}

export const useAnswerSession = create<AnswerSessionState>((set, get) => ({
  skippedIds: [],
  celebratedMilestones: [],
  skip: (id) => {
    if (get().skippedIds.includes(id)) return;
    set({ skippedIds: [...get().skippedIds, id] });
  },
  markCelebrated: (n) => {
    if (get().celebratedMilestones.includes(n)) return;
    set({ celebratedMilestones: [...get().celebratedMilestones, n] });
  },
  reset: () => set({ skippedIds: [], celebratedMilestones: [] }),
}));

/** Milestones that trigger the warm celebration banner. */
export const ANSWER_MILESTONES = [10, 25, 50, 100] as const;

/**
 * Returns the first milestone the user just crossed, or null. We trigger
 * when the count is exactly a milestone (so we don't fire on every count
 * >= 10 after they cross 10).
 */
export function milestoneForCount(count: number): number | null {
  for (const m of ANSWER_MILESTONES) {
    if (count === m) return m;
  }
  return null;
}

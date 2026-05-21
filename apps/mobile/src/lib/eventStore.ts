import { create } from 'zustand';
import {
  EVENTS,
  ME,
  type FamilyEvent,
  type EventGuest,
  type EventPhoto,
  type EventRsvp,
  type AnyMemberId,
  type PollOption,
  type MomentMessage,
  type PackingItem,
} from './mockData';

/**
 * Local mutable copy of events so the demo can react to taps:
 * RSVPs, bring-list claims and adds, vote toggles, posting media, posting chatter.
 *
 * Mirrors the structure of momentStore but covers the richer event shape
 * (cross-branch guests, RSVPs, photos, highlights). When we wire real data
 * these mutations will become Supabase RPC calls.
 */

type EventMap = Record<string, FamilyEvent>;

function clone(e: FamilyEvent): FamilyEvent {
  return {
    ...e,
    guests: e.guests.map((g) => ({ ...g })),
    bringList: e.bringList.map((p) => ({ ...p })),
    polls: {
      date: e.polls.date?.map((o) => ({ ...o, votes: [...o.votes] })),
      location: e.polls.location?.map((o) => ({ ...o, votes: [...o.votes] })),
      activity: e.polls.activity?.map((o) => ({ ...o, votes: [...o.votes] })),
    },
    activity: e.activity.map((m) => ({ ...m })),
    photos: e.photos.map((p) => ({ ...p })),
    highlights: e.highlights ? e.highlights.map((h) => ({ ...h })) : undefined,
  };
}

const initialMap: EventMap = Object.fromEntries(EVENTS.map((e) => [e.id, clone(e)]));

interface EventState {
  events: EventMap;
  // Mutations
  setRsvp: (eventId: string, memberId: AnyMemberId, rsvp: EventRsvp) => void;
  setMyRsvp: (eventId: string, rsvp: EventRsvp) => void;
  toggleBringChecked: (eventId: string, bringItemId: string) => void;
  claimBringItem: (eventId: string, bringItemId: string, memberId: AnyMemberId) => void;
  addBringItem: (eventId: string, itemText: string, assigneeId?: AnyMemberId) => void;
  togglePollVote: (
    eventId: string,
    pollKind: 'date' | 'location' | 'activity',
    optionId: string,
    voterId?: AnyMemberId,
  ) => void;
  postPhoto: (eventId: string, photo: Omit<EventPhoto, 'id' | 'whenAgo'>) => void;
  postChatter: (eventId: string, body: string, authorId?: AnyMemberId) => void;
  inviteGuest: (eventId: string, guest: EventGuest) => void;
  addEvent: (e: FamilyEvent) => void;
  // Selectors
  getEvent: (id: string) => FamilyEvent | undefined;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: initialMap,

  setRsvp: (eventId, memberId, rsvp) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      return {
        events: {
          ...s.events,
          [eventId]: {
            ...e,
            guests: e.guests.map((g) => (g.memberId === memberId ? { ...g, rsvp } : g)),
          },
        },
      };
    }),

  setMyRsvp: (eventId, rsvp) => {
    get().setRsvp(eventId, ME, rsvp);
  },

  toggleBringChecked: (eventId, bringItemId) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      return {
        events: {
          ...s.events,
          [eventId]: {
            ...e,
            bringList: e.bringList.map((b) =>
              b.id === bringItemId ? { ...b, checked: !b.checked } : b,
            ),
          },
        },
      };
    }),

  claimBringItem: (eventId, bringItemId, memberId) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      return {
        events: {
          ...s.events,
          [eventId]: {
            ...e,
            bringList: e.bringList.map((b) =>
              b.id === bringItemId
                ? {
                    ...b,
                    // Only MemberIds can be packing assignees (legacy type), so cast safely.
                    assigneeId: memberId as PackingItem['assigneeId'],
                  }
                : b,
            ),
          },
        },
      };
    }),

  addBringItem: (eventId, itemText, assigneeId) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      const newItem: PackingItem = {
        id: `b-${Date.now()}`,
        item: itemText,
        assigneeId: assigneeId as PackingItem['assigneeId'],
        checked: false,
      };
      return {
        events: {
          ...s.events,
          [eventId]: { ...e, bringList: [...e.bringList, newItem] },
        },
      };
    }),

  togglePollVote: (eventId, pollKind, optionId, voterId = ME) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      const pool = e.polls[pollKind];
      if (!pool) return s;
      const updatedPool: PollOption[] = pool.map((opt) => {
        if (opt.id !== optionId) return opt;
        const has = opt.votes.includes(voterId);
        return {
          ...opt,
          votes: has ? opt.votes.filter((v) => v !== voterId) : [...opt.votes, voterId],
        };
      });
      return {
        events: {
          ...s.events,
          [eventId]: {
            ...e,
            polls: { ...e.polls, [pollKind]: updatedPool },
          },
        },
      };
    }),

  postPhoto: (eventId, photo) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      const newPhoto: EventPhoto = {
        ...photo,
        id: `p-${Date.now()}`,
        whenAgo: 'just now',
      };
      return {
        events: {
          ...s.events,
          [eventId]: { ...e, photos: [newPhoto, ...e.photos] },
        },
      };
    }),

  postChatter: (eventId, body, authorId = ME) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      const msg: MomentMessage = {
        id: `m-${Date.now()}`,
        authorId: authorId as MomentMessage['authorId'],
        body,
        whenAgo: 'just now',
      };
      return {
        events: {
          ...s.events,
          [eventId]: { ...e, activity: [...e.activity, msg] },
        },
      };
    }),

  inviteGuest: (eventId, guest) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      if (e.guests.some((g) => g.memberId === guest.memberId)) return s;
      return {
        events: {
          ...s.events,
          [eventId]: { ...e, guests: [...e.guests, guest] },
        },
      };
    }),

  addEvent: (e) =>
    set((s) => ({
      events: { ...s.events, [e.id]: clone(e) },
    })),

  getEvent: (id) => get().events[id],
}));

// ---- Selectors --------------------------------------------------------------

export function useEvent(id: string): FamilyEvent | undefined {
  return useEventStore((s) => s.events[id]);
}

export function useAllEvents(): FamilyEvent[] {
  return useEventStore((s) => Object.values(s.events));
}

export function useEventsInBranches(branchIds: string[]): FamilyEvent[] {
  return useEventStore((s) =>
    Object.values(s.events).filter((e) => e.branchIds.some((b) => branchIds.includes(b))),
  );
}

export function useMyRsvp(eventId: string): EventRsvp | undefined {
  return useEventStore((s) => {
    const e = s.events[eventId];
    if (!e) return undefined;
    return e.guests.find((g) => g.memberId === ME)?.rsvp;
  });
}

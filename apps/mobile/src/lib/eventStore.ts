import { useEffect } from 'react';
import { create } from 'zustand';
import {
  type FamilyEvent,
  type EventGuest,
  type EventPhoto,
  type EventRsvp,
  type AnyMemberId,
  type PollOption,
  type MomentMessage,
  type PackingItem,
} from './mockData';
import {
  addEventMessage as supaAddEventMessage,
  createEvent as supaCreateEvent,
  fetchEventMessages,
  fetchMyEvents,
  setMyRsvp as supaSetMyRsvp,
  subscribeToEventMessages,
  userIdToMemberId,
  type CreateEventInput,
} from './supabaseEvents';
import { supabase } from './supabase';
import { useSessionStore } from './sessionStore';

/**
 * Client-side mirror of the events the user can see. Initialized empty;
 * hydrated from Supabase via `useHydrateEventsFromSupabase()`.
 *
 * Mutations call through to Supabase first (or write optimistically + roll
 * back on failure) so the UI stays consistent with the persisted state.
 */

type EventMap = Record<string, FamilyEvent>;

interface EventState {
  events: EventMap;
  hydrated: boolean;
  // Replace the whole map (hydration).
  setEvents: (events: FamilyEvent[]) => void;
  upsertEvent: (event: FamilyEvent) => void;
  // Mutations (optimistic local; the screen calls the Supabase variant
  // separately and rolls back if needed via revertRsvp).
  setRsvp: (eventId: string, memberId: AnyMemberId, rsvp: EventRsvp) => void;
  toggleBringChecked: (eventId: string, bringItemId: string) => void;
  claimBringItem: (eventId: string, bringItemId: string, memberId: AnyMemberId) => void;
  addBringItem: (eventId: string, itemText: string, assigneeId?: AnyMemberId) => void;
  togglePollVote: (
    eventId: string,
    pollKind: 'date' | 'location' | 'activity',
    optionId: string,
    voterId: AnyMemberId,
  ) => void;
  postPhoto: (eventId: string, photo: Omit<EventPhoto, 'id' | 'whenAgo'>) => void;
  appendChatMessage: (eventId: string, msg: MomentMessage) => void;
  inviteGuest: (eventId: string, guest: EventGuest) => void;
  addEvent: (e: FamilyEvent) => void;
  getEvent: (id: string) => FamilyEvent | undefined;
  // Setters used by hydration helpers.
  setEventMessages: (eventId: string, messages: MomentMessage[]) => void;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: {},
  hydrated: false,

  setEvents: (events) =>
    set({
      hydrated: true,
      events: Object.fromEntries(events.map((e) => [e.id, e])),
    }),

  upsertEvent: (event) =>
    set((s) => ({ events: { ...s.events, [event.id]: event } })),

  setRsvp: (eventId, memberId, rsvp) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      const exists = e.guests.some((g) => g.memberId === memberId);
      const guests = exists
        ? e.guests.map((g) => (g.memberId === memberId ? { ...g, rsvp } : g))
        : [...e.guests, { memberId, rsvp }];
      return { events: { ...s.events, [eventId]: { ...e, guests } } };
    }),

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
              b.id === bringItemId ? { ...b, assigneeId: memberId } : b,
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
        assigneeId,
        checked: false,
      };
      return {
        events: {
          ...s.events,
          [eventId]: { ...e, bringList: [...e.bringList, newItem] },
        },
      };
    }),

  togglePollVote: (eventId, pollKind, optionId, voterId) =>
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
          [eventId]: { ...e, polls: { ...e.polls, [pollKind]: updatedPool } },
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

  appendChatMessage: (eventId, msg) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      if (e.activity.some((m) => m.id === msg.id)) return s;
      return {
        events: { ...s.events, [eventId]: { ...e, activity: [...e.activity, msg] } },
      };
    }),

  inviteGuest: (eventId, guest) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      if (e.guests.some((g) => g.memberId === guest.memberId)) return s;
      return {
        events: { ...s.events, [eventId]: { ...e, guests: [...e.guests, guest] } },
      };
    }),

  addEvent: (e) =>
    set((s) => ({ events: { ...s.events, [e.id]: e } })),

  getEvent: (id) => get().events[id],

  setEventMessages: (eventId, messages) =>
    set((s) => {
      const e = s.events[eventId];
      if (!e) return s;
      return { events: { ...s.events, [eventId]: { ...e, activity: messages } } };
    }),
}));

// ---- Hydration --------------------------------------------------------------

/**
 * Subscribe to auth + when signed-in, load events from Supabase and wire
 * Realtime subscriptions for each event's chat. Call from any top-level
 * screen that depends on events (the events tab, home, family tab).
 *
 * Safe to call from multiple screens — subscriptions are deduped by event id
 * via the channel name, and reloading the list is idempotent.
 */
const channelCleanup = new Map<string, () => void>();
// Track which user id the current channel set belongs to, so we never
// accidentally serve a stale subscription to a freshly-signed-in second user.
let channelOwnerUserId: string | null = null;
// In-flight subscription guard: prevents two concurrent calls to the hydration
// hook from both setting up a channel for the same event before either commits
// the cleanup fn to `channelCleanup`. Without this, tab-switching between the
// Events tab and the moment detail screen could spawn two websocket channels
// for the same event filter and cause every Realtime message to fire twice.
const channelSetupInFlight = new Set<string>();

function disposeAllChannels() {
  for (const [, cleanup] of channelCleanup) {
    try {
      cleanup();
    } catch {
      // ignore
    }
  }
  channelCleanup.clear();
  channelSetupInFlight.clear();
  channelOwnerUserId = null;
}

function ensureChannelForEvent(
  eventId: string,
  onMessage: (msg: MomentMessage) => void,
): void {
  if (channelCleanup.has(eventId) || channelSetupInFlight.has(eventId)) return;
  channelSetupInFlight.add(eventId);
  try {
    const cleanup = subscribeToEventMessages(eventId, onMessage);
    channelCleanup.set(eventId, cleanup);
  } finally {
    channelSetupInFlight.delete(eventId);
  }
}

export function useHydrateEventsFromSupabase(): void {
  const session = useSessionStore((s) => s.session);
  const setEvents = useEventStore((s) => s.setEvents);
  const setEventMessages = useEventStore((s) => s.setEventMessages);
  const appendChatMessage = useEventStore((s) => s.appendChatMessage);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      // Signed out — clear everything. Also dispose channels so a re-signin
      // (even as a different user) starts from a clean slate.
      disposeAllChannels();
      setEvents([]);
      return () => {
        cancelled = true;
      };
    }

    // If the active user changed, tear down any leftover channels from the
    // previous account before we wire up new ones. Without this, a user who
    // signs out and signs back in as someone else would briefly receive
    // Realtime messages on channels filtered to the previous user's events.
    if (channelOwnerUserId && channelOwnerUserId !== session.user.id) {
      disposeAllChannels();
    }
    channelOwnerUserId = session.user.id;

    (async () => {
      let events: FamilyEvent[] = [];
      try {
        events = await fetchMyEvents();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[eventStore] fetchMyEvents failed:', err);
      }
      if (cancelled) return;
      setEvents(events);

      // Fetch initial messages + subscribe to Realtime for each event.
      for (const e of events) {
        // Dedupe: skip if a channel exists OR is mid-setup from a concurrent
        // hydrate call from another screen.
        ensureChannelForEvent(e.id, (msg) => {
          appendChatMessage(e.id, msg);
        });

        try {
          const msgs = await fetchEventMessages(e.id);
          if (!cancelled) setEventMessages(e.id, msgs);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[eventStore] message hydrate failed for', e.id, err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, setEvents, setEventMessages, appendChatMessage]);

  // Cleanup channels on unmount of the LAST consumer would be nice; for now we
  // leave them attached for the session lifetime since the cost is small and
  // the channel filter is scoped per-event. They DO get torn down on signout
  // via disposeAllChannels() above.
}

// ---- Write-through helpers --------------------------------------------------

/**
 * Optimistic + persisted: set my RSVP for an event. Reverts the local store
 * if Supabase rejects the update.
 */
export async function setMyRsvpForEvent(eventId: string, rsvp: EventRsvp): Promise<void> {
  if (rsvp === 'invited') return; // not a user action
  const myUuid = useSessionStore.getState().user?.id;
  if (!myUuid) return;
  const myMemberId = userIdToMemberId(myUuid);

  const prev = useEventStore.getState().events[eventId];
  const prevRsvp = prev?.guests.find((g) => g.memberId === myMemberId)?.rsvp;

  // Optimistic local update.
  useEventStore.getState().setRsvp(eventId, myMemberId, rsvp);

  try {
    await supaSetMyRsvp(eventId, rsvp);
  } catch (err) {
    // Revert.
    if (prevRsvp) {
      useEventStore.getState().setRsvp(eventId, myMemberId, prevRsvp);
    }
    // eslint-disable-next-line no-console
    console.warn('[eventStore] RSVP update failed:', err);
    throw err;
  }
}

/**
 * Send a chat message. We do NOT optimistically inject into the activity list:
 * the Realtime INSERT subscription will land it for everyone (us included),
 * which keeps message ids stable.
 */
export async function sendEventMessage(eventId: string, body: string): Promise<void> {
  await supaAddEventMessage(eventId, body);
}

/**
 * Create an event, push it into the store, and return the id so the caller
 * can navigate to it.
 */
export async function createEventFromInput(input: CreateEventInput): Promise<string> {
  const { eventId } = await supaCreateEvent(input);
  // Refetch this event so all of the derived fields (status, dateRangeText,
  // host guest row) are populated.
  const events = await fetchMyEvents();
  const fresh = events.find((e) => e.id === eventId);
  if (fresh) {
    useEventStore.getState().upsertEvent(fresh);
    // Also wire up Realtime for the new event right away. Use the shared
    // dedupe helper so we don't double-subscribe if the events tab's
    // useHydrateEventsFromSupabase() races us.
    ensureChannelForEvent(eventId, (msg) => {
      useEventStore.getState().appendChatMessage(eventId, msg);
    });
  }
  return eventId;
}

// ---- Selectors --------------------------------------------------------------

export function useEvent(id: string): FamilyEvent | undefined {
  return useEventStore((s) => s.events[id]);
}

export function useAllEvents(): FamilyEvent[] {
  return useEventStore((s) => Object.values(s.events));
}

export function useEventsInBranches(_branchIds: string[]): FamilyEvent[] {
  // Branch scoping is a legacy hard-coded concept; right now every event the
  // user can see goes in the "my family" bucket. Once we wire event_circles
  // into the store this can re-filter by branchIds.
  return useEventStore((s) => Object.values(s.events));
}

export function useMyRsvp(eventId: string): EventRsvp | undefined {
  // Subscribe to BOTH stores explicitly so the RSVP re-resolves when either
  // the event roster OR the signed-in user changes. The previous version
  // called useSessionStore.getState() inside the event-store selector, which
  // meant the RSVP would not update on sign-in/out without a separate event
  // refresh.
  const myUuid = useSessionStore((s) => s.user?.id);
  return useEventStore((s) => {
    const e = s.events[eventId];
    if (!e || !myUuid) return undefined;
    const id = userIdToMemberId(myUuid);
    return e.guests.find((g) => g.memberId === id)?.rsvp;
  });
}

// Disposal helper for hot-reload / tests.
export function disposeEventSubscriptions(): void {
  disposeAllChannels();
  // Best-effort: also flush any unused channels at the supabase client level.
  void supabase.removeAllChannels();
}

/**
 * demoData.ts — warm, realistic mock data shown to brand-new users who haven't
 * invited anyone yet. The moment their primary circle gains a second member,
 * `useHasFamily()` flips and every screen drops this in favor of real Supabase
 * data.
 *
 * This is intentionally separate from `mockData.ts`, which holds compile-time
 * type stubs and was deliberately stripped of seeded people. Demo data is a
 * different concern: it's a guided tour, not a fallback for missing screens.
 *
 * Every export is `as const` / deeply readonly so screens can't accidentally
 * mutate it. Adapter functions (e.g. `eventsFromDemo()`) return fresh shallow
 * copies in the shape the real-data path expects, so JSX stays identical.
 */

import {
  type FamilyEvent,
  type MomentMessage,
  type EventGuest,
  type PackingItem,
  type AnyMemberId,
  type ExtendedMember,
  type Member,
} from './mockData';

// ---- Cast helper for as-const literals -------------------------------------

// The demo data lives on the read-only branch — screens get a defensively
// shallow-copied version via the adapters at the bottom. We use `as const`
// for the source-of-truth so accidental mutation upstairs is caught at TS.

// ---- Demo people -----------------------------------------------------------

/**
 * Synthetic ids — prefixed `demo_` so they never collide with the
 * `user_<uuid8>` ids real Supabase users emit. `getAnyMember()` in mockData
 * returns a safe placeholder for unknown ids, which keeps any stray rendering
 * alive even if a demo id leaks somewhere it shouldn't.
 */
export const DEMO_PEOPLE = {
  mom: {
    id: 'demo_mom',
    name: 'Linda (Mom)',
    relationship: 'Mom',
    initials: 'LP',
    color: '#B9701D',
    age: 64,
  },
  dad: {
    id: 'demo_dad',
    name: 'Tom (Dad)',
    relationship: 'Dad',
    initials: 'TP',
    color: '#2E8B57',
    age: 67,
  },
  grandma: {
    id: 'demo_grandma',
    name: 'Grace (Grandma)',
    relationship: 'Grandma',
    initials: 'GP',
    color: '#8C5BB1',
    age: 86,
  },
  brother: {
    id: 'demo_brother',
    name: 'Mike (Brother)',
    relationship: 'Brother',
    initials: 'MP',
    color: '#3B7BC9',
    age: 34,
  },
} as const;

export type DemoPersonKey = keyof typeof DEMO_PEOPLE;
export type DemoMemberId = (typeof DEMO_PEOPLE)[DemoPersonKey]['id'];

/**
 * DiceBear-style identicon URL generator. Pure (no network at import time);
 * the avatar component renders initials if loading fails anyway.
 */
function dicebearUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

export const DEMO_PEOPLE_LIST = Object.values(DEMO_PEOPLE);

// ---- Today's question (for Home elder hero) --------------------------------

export const DEMO_TODAY_PROMPT = {
  id: 'demo_today_q',
  prompt: 'What\'s a song that brings you straight back to childhood?',
  source: 'curated',
  fromName: 'FamLink',
} as const;

// ---- Inbox: questions someone asked you ------------------------------------

export const DEMO_INBOX = [
  {
    id: 'demo_q1',
    fromId: 'demo_mom',
    body: 'What\'s your favorite thing we did together when you were little?',
    whenAgo: '2h ago',
  },
  {
    id: 'demo_q2',
    fromId: 'demo_grandma',
    body: 'Tell me about the first job you ever loved.',
    whenAgo: 'yesterday',
  },
] as const;

// ---- Suggested questions (Ask tab, younger user) ---------------------------

export const DEMO_SUGGESTED_QUESTIONS = [
  {
    askId: 'demo_grandma',
    text: 'What was your wedding day actually like?',
  },
  {
    askId: 'demo_dad',
    text: 'What did you wish someone had told you at 25?',
  },
  {
    askId: 'demo_mom',
    text: 'What\'s a story about me as a baby I\'ve never heard?',
  },
] as const;

// ---- Answered prompts (for personal timelines) ----------------------------

export const DEMO_ANSWERED = [
  {
    id: 'demo_a1',
    authorId: 'demo_mom',
    question: 'Tell me about the day you brought me home.',
    answer:
      'You were so quiet in the car seat we kept checking you were still breathing. Your dad drove 25mph the whole way home — it took an hour for a fifteen-minute trip.',
    whenAgo: '3d ago',
  },
  {
    id: 'demo_a2',
    authorId: 'demo_dad',
    question: 'What was your first job?',
    answer:
      'I bagged groceries at Stop & Shop the summer I was sixteen. Two-twenty-five an hour. I bought my first guitar with that money.',
    whenAgo: '1w ago',
  },
  {
    id: 'demo_a3',
    authorId: 'demo_grandma',
    question: 'How did you and Grandpa meet?',
    answer:
      'A dance at the church hall. He stepped on my foot twice and then asked if I wanted to get out of there. We walked to a diner and stayed until they kicked us out.',
    whenAgo: '2w ago',
  },
  {
    id: 'demo_a4',
    authorId: 'demo_brother',
    question: 'What\'s your favorite memory of our childhood?',
    answer:
      'The summer we built that fort in the backyard out of pallets dad brought home from work. We slept out there three nights in a row before it rained.',
    whenAgo: '4d ago',
  },
  {
    id: 'demo_a5',
    authorId: 'demo_grandma',
    question: 'What\'s a lesson you want passed down?',
    answer:
      'Don\'t wait for the perfect time to call someone you love. The perfect time is now. I called my mother every Sunday for forty years.',
    whenAgo: '3w ago',
  },
  {
    id: 'demo_a6',
    authorId: 'demo_mom',
    question: 'What were you like in high school?',
    answer:
      'Shy until junior year, then I joined yearbook and discovered I liked being the one behind the camera. I still have the box of photos somewhere.',
    whenAgo: '1m ago',
  },
] as const;

// ---- Events ----------------------------------------------------------------

const ALL_DEMO_GUESTS: readonly EventGuest[] = [
  { memberId: 'me' as AnyMemberId, rsvp: 'going', isHost: true },
  { memberId: DEMO_PEOPLE.mom.id as unknown as AnyMemberId, rsvp: 'going' },
  { memberId: DEMO_PEOPLE.dad.id as unknown as AnyMemberId, rsvp: 'going' },
  { memberId: DEMO_PEOPLE.grandma.id as unknown as AnyMemberId, rsvp: 'maybe' },
  { memberId: DEMO_PEOPLE.brother.id as unknown as AnyMemberId, rsvp: 'going' },
] as const;

const REUNION_BRING_LIST: readonly PackingItem[] = [
  { id: 'demo_b1', item: 'Cooler + ice', assigneeId: DEMO_PEOPLE.brother.id as unknown as AnyMemberId, checked: false },
  { id: 'demo_b2', item: 'Grandma\'s pie pans', assigneeId: DEMO_PEOPLE.mom.id as unknown as AnyMemberId, checked: true },
  { id: 'demo_b3', item: 'Lawn games', checked: false },
  { id: 'demo_b4', item: 'Bug spray (the strong kind)', assigneeId: 'me' as AnyMemberId, checked: false },
  { id: 'demo_b5', item: 'Old photo albums', assigneeId: DEMO_PEOPLE.grandma.id as unknown as AnyMemberId, checked: false },
] as const;

const REUNION_CHAT: readonly MomentMessage[] = [
  {
    id: 'demo_m1',
    authorId: DEMO_PEOPLE.mom.id as unknown as AnyMemberId,
    body: 'Counting down already. Who\'s bringing the corn?',
    whenAgo: '2d ago',
    at: '2026-06-19T14:22:00Z',
  },
  {
    id: 'demo_m2',
    authorId: DEMO_PEOPLE.brother.id as unknown as AnyMemberId,
    body: 'Me. I\'ll grab three dozen ears the morning of.',
    whenAgo: '2d ago',
    at: '2026-06-19T14:30:00Z',
  },
  {
    id: 'demo_m3',
    authorId: 'me' as AnyMemberId,
    body: 'I can do desserts. Anyone allergic to nuts now?',
    whenAgo: '2d ago',
    at: '2026-06-19T15:01:00Z',
  },
  {
    id: 'demo_m4',
    authorId: DEMO_PEOPLE.grandma.id as unknown as AnyMemberId,
    body: 'Just me dear. Same as always.',
    whenAgo: '2d ago',
    at: '2026-06-19T16:12:00Z',
  },
  {
    id: 'demo_m5',
    authorId: DEMO_PEOPLE.dad.id as unknown as AnyMemberId,
    body: 'Putting together a playlist. Send me one song each.',
    whenAgo: '1d ago',
    at: '2026-06-20T10:00:00Z',
  },
  {
    id: 'demo_m6',
    authorId: DEMO_PEOPLE.mom.id as unknown as AnyMemberId,
    body: 'Fleetwood Mac, Landslide.',
    whenAgo: '1d ago',
    at: '2026-06-20T10:04:00Z',
  },
  {
    id: 'demo_m7',
    authorId: DEMO_PEOPLE.brother.id as unknown as AnyMemberId,
    body: 'Springsteen — Thunder Road.',
    whenAgo: '23h ago',
    at: '2026-06-20T11:15:00Z',
  },
  {
    id: 'demo_m8',
    authorId: 'me' as AnyMemberId,
    body: 'Whichever song was playing the day we found that fort in the woods.',
    whenAgo: '5h ago',
    at: '2026-06-21T08:30:00Z',
  },
] as const;

export const DEMO_EVENTS: readonly FamilyEvent[] = [
  {
    id: 'demo_event_reunion',
    branchIds: ['pilks'],
    kind: 'reunion',
    title: 'Pilks Family Reunion',
    subtitle: 'Three generations under one roof',
    dateRangeText: 'Jul 17 – Jul 20, 2026',
    startsAt: '2026-07-17',
    endsAt: '2026-07-20',
    status: 'upcoming',
    coverTint: '#E8B274',
    coverGlyph: '🌾',
    locationText: 'Aunt Susan\'s place, Hudson Valley NY',
    organizerId: 'me' as AnyMemberId,
    guests: ALL_DEMO_GUESTS as EventGuest[],
    bringList: REUNION_BRING_LIST as PackingItem[],
    polls: {},
    activity: REUNION_CHAT as MomentMessage[],
    photos: [],
    highlights: [],
  },
  {
    id: 'demo_event_thanksgiving',
    branchIds: ['pilks'],
    kind: 'holiday',
    title: 'Thanksgiving at Grandma\'s',
    subtitle: 'The whole crew',
    dateRangeText: 'Nov 27, 2025',
    startsAt: '2025-11-27',
    endsAt: '2025-11-27',
    status: 'past',
    coverTint: '#C0345C',
    coverGlyph: '🦃',
    locationText: 'Grandma Grace\'s',
    organizerId: DEMO_PEOPLE.grandma.id as unknown as AnyMemberId,
    guests: ALL_DEMO_GUESTS as EventGuest[],
    bringList: [],
    polls: {},
    activity: [
      {
        id: 'demo_tg1',
        authorId: DEMO_PEOPLE.grandma.id as unknown as AnyMemberId,
        body: 'Three pies this year, two birds. Bring your appetite.',
        whenAgo: '6m ago',
        at: '2025-11-25T15:00:00Z',
      },
      {
        id: 'demo_tg2',
        authorId: DEMO_PEOPLE.mom.id as unknown as AnyMemberId,
        body: 'I\'ll handle stuffing. Same as last year.',
        whenAgo: '6m ago',
        at: '2025-11-25T15:30:00Z',
      },
    ],
    photos: [],
    highlights: [],
  },
  {
    id: 'demo_event_birthday',
    branchIds: ['pilks'],
    kind: 'gathering',
    title: 'Grandma Grace\'s 87th',
    subtitle: 'Small dinner, big cake',
    dateRangeText: 'Aug 12, 2026',
    startsAt: '2026-08-12',
    endsAt: '2026-08-12',
    status: 'upcoming',
    coverTint: '#9BC97A',
    coverGlyph: '🎂',
    locationText: 'TBD',
    organizerId: DEMO_PEOPLE.mom.id as unknown as AnyMemberId,
    guests: ALL_DEMO_GUESTS as EventGuest[],
    bringList: [],
    polls: {},
    activity: [
      {
        id: 'demo_b1m',
        authorId: DEMO_PEOPLE.mom.id as unknown as AnyMemberId,
        body: 'Restaurant or backyard? Vote here.',
        whenAgo: '3d ago',
        at: '2026-06-18T19:00:00Z',
      },
    ],
    photos: [],
    highlights: [],
  },
] as const;

// ---- Notifications --------------------------------------------------------

export const DEMO_NOTIFICATIONS = [
  {
    id: 'demo_n1',
    kind: 'question_received' as const,
    fromId: DEMO_PEOPLE.mom.id,
    fromName: DEMO_PEOPLE.mom.name,
    body: 'Linda asked you a memory question.',
    whenAgo: '1h ago',
    unread: true,
  },
  {
    id: 'demo_n2',
    kind: 'answer_received' as const,
    fromId: DEMO_PEOPLE.grandma.id,
    fromName: DEMO_PEOPLE.grandma.name,
    body: 'Grandma Grace answered your question about her wedding day.',
    whenAgo: '3h ago',
    unread: true,
  },
  {
    id: 'demo_n3',
    kind: 'moment_update' as const,
    fromId: DEMO_PEOPLE.dad.id,
    fromName: DEMO_PEOPLE.dad.name,
    body: 'Tom voted on dates for the Pilks Reunion.',
    whenAgo: 'yesterday',
    unread: false,
  },
  {
    id: 'demo_n4',
    kind: 'digest' as const,
    fromId: null,
    fromName: null,
    body: 'Your family added 4 memories this week. Take a look.',
    whenAgo: '1w ago',
    unread: false,
  },
] as const;

// ---- Adapters --------------------------------------------------------------
// Each adapter returns a fresh shallow copy in the same shape the real-data
// path uses. Screens swap `realFoo` for `fooFromDemo()` based on `hasFamily`.

export function eventsFromDemo(): FamilyEvent[] {
  // Spread to defeat the readonly tuple type; screens treat events as mutable.
  return DEMO_EVENTS.map((e) => ({
    ...e,
    branchIds: [...e.branchIds],
    guests: e.guests.map((g) => ({ ...g })),
    bringList: e.bringList.map((b) => ({ ...b })),
    polls: { ...e.polls },
    activity: e.activity.map((m) => ({ ...m })),
    photos: e.photos.map((p) => ({ ...p })),
    highlights: e.highlights ? e.highlights.map((h) => ({ ...h })) : [],
  }));
}

export function demoMembersAsExtended(): ExtendedMember[] {
  return DEMO_PEOPLE_LIST.map((p) => ({
    id: p.id as unknown as ExtendedMember['id'],
    name: p.name,
    relationship: p.relationship,
    initials: p.initials,
    color: p.color,
    age: p.age,
    branchId: 'pilks',
    metAtEvent: false,
  }));
}

/**
 * Look up a demo person by their id. Returns undefined if not a demo id.
 */
export function getDemoMember(id: string): Member | undefined {
  const found = DEMO_PEOPLE_LIST.find((p) => p.id === id);
  if (!found) return undefined;
  return {
    id: 'me', // fake — screens reading `id` mostly use it for keys; name/relationship is what matters
    name: found.name,
    relationship: found.relationship,
    initials: found.initials,
    color: found.color,
    age: found.age,
  };
}

/**
 * Lightweight display lookup for any demo member id. Screens that already
 * route demo ids through `getAnyMember()` get a safe placeholder; this is the
 * narrower path that knows the real demo names.
 */
export function demoMemberDisplay(id: AnyMemberId): {
  name: string;
  initials: string;
  color: string;
  relationship: string;
} | undefined {
  // Cast both sides to string: AnyMemberId is the narrow set of real-data ids,
  // and demo ids deliberately live outside it (`demo_*`). TS would otherwise
  // narrow the comparison to "never overlap" because no demo id literal
  // appears in AnyMemberId — but at runtime an id passed through here can
  // very well be a demo id (Chats tab does this for message author lookup).
  const m = DEMO_PEOPLE_LIST.find((p) => (p.id as string) === (id as string));
  if (!m) return undefined;
  return {
    name: m.name,
    initials: m.initials,
    color: m.color,
    relationship: m.relationship,
  };
}

/** Avatar URL for a demo person (DiceBear initials). Optional; not used yet. */
export function demoAvatarUrl(id: string): string {
  return dicebearUrl(id);
}

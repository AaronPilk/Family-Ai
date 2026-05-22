/**
 * Type registry + minimal compile-time stubs for the FamLink demo surfaces
 * that haven't been wired to Supabase yet.
 *
 * IMPORTANT — this used to be a big seeded-fixtures file. We are mid-migration:
 *  - Events + event chat now talk to Supabase (see lib/supabaseEvents.ts and
 *    the hydration in lib/eventStore.ts).
 *  - The rest of the app (Ask / Timeline / Vault / Feed) is still hard-coded
 *    UI scaffolding, but we DO NOT want fake people ("Linda", "Mike", "Grace")
 *    leaking into real users' sessions. So the seeded arrays/maps are emptied
 *    here.
 *
 * What stays:
 *  - All `export type` / `export interface` declarations (the rest of the app
 *    imports them for typing).
 *  - Utility helpers (daysUntil, rsvpCount, momentsForBranches, etc.).
 *  - `ME` and `MEMBERS` — the legacy hard-coded "me" identity is referenced by
 *    Ask / Timeline composer code that we'll retire in a later batch. Keeping
 *    these as compile-time stubs avoids touching every legacy screen in this
 *    pass. The Ask/Timeline tabs render empty states until they're wired up.
 *
 * What's empty:
 *  - EVENTS, MOMENTS, VAULT, FEED, INBOX, SUGGESTED_QUESTIONS,
 *    PHOTO_BOOKS, TODAY_PROMPTS, MEMORIES_WITH, EXTENDED_MEMBERS.
 */

// ---- CORE MEMBER ID UNIONS --------------------------------------------------

export type MemberId = 'me' | 'mom' | 'dad' | 'mike' | 'grace' | 'jake' | 'cole';

/**
 * Extended-family ids — aunts, uncles, cousins, in-laws, friends. Empty in
 * v1 of the Supabase wiring; the type stays so legacy screens compile.
 */
export type ExtendedMemberId =
  | 'aunt_susan'
  | 'uncle_pete'
  | 'cousin_sara'
  | 'cousin_emma'
  | 'cousin_ben'
  | 'aunt_diane'
  | 'gramp_hal'
  | 'mike_partner'
  | 'jake_partner'
  | 'family_friend_ruth';

/**
 * Synthetic id for any authenticated Supabase user. The events layer emits
 * these so screens can keep using the AnyMemberId union without knowing about
 * UUIDs. Format: `user_<first 8 of uuid>`.
 */
export type SupabaseUserMemberId = `user_${string}`;

export type AnyMemberId = MemberId | ExtendedMemberId | SupabaseUserMemberId;

export interface Member {
  id: MemberId;
  name: string;
  relationship: string;
  initials: string;
  color: string;
  age?: number;
}

export interface ExtendedMember {
  id: ExtendedMemberId;
  name: string;
  relationship: string;
  initials: string;
  color: string;
  age?: number;
  branchId: BranchId;
  metAtEvent?: boolean;
}

export const ME: MemberId = 'me';

/**
 * Compile-time stub. The Ask/Timeline composer code still does
 * `MEMBERS[someId]`; until those screens are retired we keep the keys
 * present with neutral placeholder data so a render won't crash.
 */
export const MEMBERS: Record<MemberId, Member> = {
  me: { id: 'me', name: 'You', relationship: 'You', initials: 'Y', color: '#C0345C' },
  mom: { id: 'mom', name: '', relationship: '', initials: '', color: '#B9701D' },
  dad: { id: 'dad', name: '', relationship: '', initials: '', color: '#2E8B57' },
  mike: { id: 'mike', name: '', relationship: '', initials: '', color: '#3B7BC9' },
  grace: { id: 'grace', name: '', relationship: '', initials: '', color: '#8C5BB1' },
  jake: { id: 'jake', name: '', relationship: '', initials: '', color: '#D49B3E' },
  cole: { id: 'cole', name: '', relationship: '', initials: '', color: '#5C9E8C' },
};

// ---- BRANCHES ---------------------------------------------------------------

export type BranchId = 'pilks' | 'stepfamily';

export interface Branch {
  id: BranchId;
  name: string;
  shortName: string;
  memberIds: MemberId[];
  color: string;
  memoryCount: number;
  optional?: boolean;
}

/**
 * Compile-time branch stubs. Real branches will come from Supabase
 * (`family_circles`) in a later pass; until then the branch store seeds with
 * 'pilks' for compatibility, but only `me` is in it — so screens render as
 * "just you" not "you + four invented people".
 */
export const BRANCHES: Record<BranchId, Branch> = {
  pilks: {
    id: 'pilks',
    name: 'My family',
    shortName: 'My family',
    memberIds: ['me'],
    color: '#C0345C',
    memoryCount: 0,
  },
  stepfamily: {
    id: 'stepfamily',
    name: 'My other family',
    shortName: 'My other family',
    memberIds: ['me'],
    color: '#2E8B57',
    memoryCount: 0,
    optional: true,
  },
};

export const BRANCH_LIST: Branch[] = [BRANCHES.pilks];
export const ALL_BRANCHES: Branch[] = [BRANCHES.pilks, BRANCHES.stepfamily];

export function membersOf(branchId: BranchId): Member[] {
  return BRANCHES[branchId].memberIds.filter((id) => id !== 'me').map((id) => MEMBERS[id]);
}

// ---- FEED ITEMS -------------------------------------------------------------

export type MediaKind = 'voice' | 'video' | 'photo' | 'text';
export type Visibility = 'just_us' | 'family' | 'only_me' | 'vault';

export interface FeedItem {
  id: string;
  branchId: BranchId;
  authorId: MemberId;
  kind: 'question' | 'answer' | 'post' | 'milestone';
  body: string;
  mediaKind?: MediaKind;
  mediaCaption?: string;
  durationSec?: number;
  photoTint?: string;
  relatedToName?: string;
  visibility: Visibility;
  topic?: string;
  reactions: number;
  comments: number;
  whenAgo: string;
  appearsIn: string[];
}

export const FEED: FeedItem[] = [];

export function feedForBranch(branchId: BranchId): FeedItem[] {
  return FEED.filter((f) => f.branchId === branchId);
}

// ---- TODAY PROMPTS ----------------------------------------------------------

export interface TodayPrompt {
  id: string;
  prompt: string;
  source: 'ai' | 'curated' | 'family';
  fromName?: string;
}

/**
 * Empty for fresh users; Home falls back to a friendly empty state when no
 * prompt is available for the active branch.
 */
export const TODAY_PROMPTS: Partial<Record<BranchId, TodayPrompt>> = {};

// ---- INBOX ------------------------------------------------------------------

export interface InboxQuestion {
  id: string;
  branchId: BranchId;
  fromId: MemberId;
  body: string;
  whenAgo: string;
}

export const INBOX: InboxQuestion[] = [];

export function inboxForBranch(branchId: BranchId): InboxQuestion[] {
  return INBOX.filter((q) => q.branchId === branchId);
}

// ---- SUGGESTED QUESTIONS ----------------------------------------------------

export const SUGGESTED_QUESTIONS: { branchId: BranchId; ask: MemberId; text: string }[] = [];

// ---- VAULT ------------------------------------------------------------------

export type VaultMediaKind = 'voice' | 'video' | 'photo' | 'text' | 'money';

export interface VaultItem {
  id: string;
  creatorId: MemberId;
  title: string;
  releaseText: string;
  recipientIds: MemberId[];
  mediaKind: VaultMediaKind;
  durationSec?: number;
  amountUsd?: number;
  status: 'sealed' | 'scheduled' | 'released';
}

export const VAULT: VaultItem[] = [];

// ---- TOPICS -----------------------------------------------------------------

export const TOPICS: { slug: string; label: string; count: number }[] = [];

// ---- PHOTO BOOKS ------------------------------------------------------------

export interface PhotoBook {
  id: string;
  title: string;
  ownerId: MemberId;
  pageCount: number;
  status: 'capturing' | 'processing' | 'ready';
  coverTint: string;
  yearRange: string;
}

export const PHOTO_BOOKS: PhotoBook[] = [];

// ---- FAMILY MOMENTS ---------------------------------------------------------

export type MomentStatus = 'planning' | 'upcoming' | 'happening' | 'past';

export interface PollOption {
  id: string;
  label: string;
  subtitle?: string;
  tint?: string;
  votes: AnyMemberId[];
}

export interface PackingItem {
  id: string;
  item: string;
  assigneeId?: AnyMemberId;
  checked: boolean;
}

export interface MomentMessage {
  id: string;
  authorId: AnyMemberId;
  body: string;
  whenAgo: string;
  at?: string;
}

export interface FamilyMoment {
  id: string;
  branchId: BranchId;
  title: string;
  subtitle: string;
  status: MomentStatus;
  dateRangeText: string;
  coverTint: string;
  coverGlyph: string;
  organizerId: AnyMemberId;
  participantIds: AnyMemberId[];
  datePoll?: PollOption[];
  locationPoll?: PollOption[];
  packingList?: PackingItem[];
  activity: MomentMessage[];
}

export const MOMENTS: FamilyMoment[] = [];

export function momentsForBranches(branchIds: BranchId[]): FamilyMoment[] {
  return MOMENTS.filter((m) => branchIds.includes(m.branchId));
}

// ---- LABELS -----------------------------------------------------------------

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  just_us: 'Just us',
  family: 'Branch',
  only_me: 'Only me',
  vault: 'Vault',
};

export const MEMORIES_WITH: Partial<Record<MemberId, number>> = {};

// ---- IMMEDIATE FAMILY -------------------------------------------------------

export const IMMEDIATE_FAMILY_IDS: Set<MemberId> = new Set<MemberId>();

export function isImmediate(id: MemberId): boolean {
  return IMMEDIATE_FAMILY_IDS.has(id);
}

// ---- EXTENDED FAMILY --------------------------------------------------------

export const EXTENDED_MEMBERS: Partial<Record<ExtendedMemberId, ExtendedMember>> = {};

/**
 * Look up any member id (legacy MemberId, ExtendedMemberId, or a synthetic
 * `user_<...>` id for Supabase users). Returns a safe placeholder when the id
 * isn't known — important because event guests can be arbitrary uuids whose
 * profiles haven't loaded yet.
 */
export function getAnyMember(id: AnyMemberId): {
  name: string;
  initials: string;
  color: string;
  relationship: string;
} {
  if (id in MEMBERS) {
    const m = MEMBERS[id as MemberId];
    return { name: m.name || 'You', initials: m.initials || 'Y', color: m.color, relationship: m.relationship };
  }
  const ext = EXTENDED_MEMBERS[id as ExtendedMemberId];
  if (ext) return ext;
  // Synthetic Supabase user id — caller should hydrate the display name via
  // useSupabaseProfile() and pass it down; this fallback keeps the UI alive.
  const initials = typeof id === 'string' ? id.slice(0, 1).toUpperCase() : '?';
  return {
    name: 'Family member',
    initials,
    color: '#7A4A8C',
    relationship: '',
  };
}

// ---- EVENTS / REUNIONS ------------------------------------------------------

export type EventKind = 'reunion' | 'vacation' | 'holiday' | 'gathering' | 'other';
export type EventRsvp = 'invited' | 'going' | 'maybe' | 'no';

export interface EventGuest {
  memberId: AnyMemberId;
  rsvp: EventRsvp;
  isHost?: boolean;
  pendingInvite?: boolean;
  displayName?: string;
}

export interface EventPhoto {
  id: string;
  authorId: AnyMemberId;
  tint: string;
  caption?: string;
  whenAgo: string;
  mediaKind: 'photo' | 'video';
  durationSec?: number;
  reactions: number;
}

export interface EventHighlight {
  kind: 'photo' | 'quote' | 'poll_result' | 'top_chatter';
  photoId?: string;
  body: string;
  authorId?: AnyMemberId;
}

export interface FamilyEvent {
  id: string;
  branchIds: BranchId[];
  kind: EventKind;
  title: string;
  subtitle: string;
  dateRangeText: string;
  startsAt: string;
  endsAt: string;
  status: MomentStatus;
  coverTint: string;
  coverGlyph: string;
  locationText?: string;
  organizerId: AnyMemberId;
  guests: EventGuest[];
  bringList: PackingItem[];
  polls: {
    date?: PollOption[];
    location?: PollOption[];
    activity?: PollOption[];
  };
  activity: MomentMessage[];
  photos: EventPhoto[];
  highlights?: EventHighlight[];
}

export function rsvpCount(event: FamilyEvent, status: EventRsvp): number {
  return event.guests.filter((g) => g.rsvp === status).length;
}

/**
 * Empty by default; populated at runtime from Supabase via the event store
 * hydration hook. Legacy code that pulls from here will simply see an empty
 * list, and `eventsForBranches` / etc. return empty arrays.
 */
export const EVENTS: FamilyEvent[] = [];

export function eventsForBranches(branchIds: BranchId[]): FamilyEvent[] {
  return EVENTS.filter((e) => e.branchIds.some((b) => branchIds.includes(b)));
}

export function upcomingEventsForBranches(branchIds: BranchId[]): FamilyEvent[] {
  return eventsForBranches(branchIds)
    .filter((e) => e.status === 'planning' || e.status === 'upcoming' || e.status === 'happening')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function pastEventsForBranches(branchIds: BranchId[]): FamilyEvent[] {
  return eventsForBranches(branchIds)
    .filter((e) => e.status === 'past')
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export function nextEventForBranches(branchIds: BranchId[]): FamilyEvent | undefined {
  return upcomingEventsForBranches(branchIds)[0];
}

export function daysUntil(isoDate: string, today: Date = new Date()): number {
  const t = new Date(isoDate + 'T00:00:00');
  const diff = Math.ceil((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

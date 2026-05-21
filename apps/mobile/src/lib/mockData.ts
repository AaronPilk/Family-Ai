/**
 * Demo data. Replace with real Supabase queries in Batch 1+.
 * Shapes mirror packages/db/migrations loosely — close enough to preview the UI.
 *
 * Branches model: Aaron's real family is divorced. He belongs to TWO branches:
 *  - mom_side: Aaron + Mom (Linda) + Brother (Mike) + Grandma (Grace)
 *  - dad_side: Aaron + Dad (Tom) + 2 stepbrothers (Jake, Cole)
 * Asks and posts in one branch never appear in the other.
 */

export type MemberId = 'me' | 'mom' | 'dad' | 'mike' | 'grace' | 'jake' | 'cole';

/**
 * Extended family ids — aunts, uncles, cousins, in-laws, family friends.
 * Kept separate from the core MemberId union so the legacy product (Ask /
 * Timeline / Vault) keeps its tight, declared inner-ring shape, while events
 * can invite from the wider graph. Per the kin-event-mode plan: immediate
 * family = mom/dad/sibling/grandparent, NOT cousins.
 */
export type ExtendedMemberId =
  | 'aunt_susan' // Mom's sister
  | 'uncle_pete' // Mom's brother
  | 'cousin_sara' // Susan's daughter
  | 'cousin_emma' // Susan's daughter
  | 'cousin_ben' // Pete's son
  | 'aunt_diane' // Dad's sister
  | 'gramp_hal' // Dad's father (Aaron's paternal grandfather)
  | 'mike_partner' // Mike's partner
  | 'jake_partner' // Jake's partner
  | 'family_friend_ruth'; // Long-time family friend

export type AnyMemberId = MemberId | ExtendedMemberId;

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
  /** Which side of the family they hang off (for cross-branch reunion mixing). */
  branchId: BranchId;
  /** True if they came in via a prior event rather than a declared relationship. */
  metAtEvent?: boolean;
}

export const ME: MemberId = 'me';

export const MEMBERS: Record<MemberId, Member> = {
  me: { id: 'me', name: 'Aaron', relationship: 'You', initials: 'A', color: '#C0345C' },
  mom: { id: 'mom', name: 'Linda', relationship: 'Mom', initials: 'L', color: '#B9701D', age: 62 },
  dad: { id: 'dad', name: 'Tom', relationship: 'Dad', initials: 'T', color: '#2E8B57', age: 64 },
  mike: {
    id: 'mike',
    name: 'Mike',
    relationship: 'Brother',
    initials: 'M',
    color: '#3B7BC9',
    age: 38,
  },
  grace: {
    id: 'grace',
    name: 'Grace',
    relationship: 'Grandma',
    initials: 'G',
    color: '#8C5BB1',
    age: 84,
  },
  jake: {
    id: 'jake',
    name: 'Jake',
    relationship: 'Stepbrother',
    initials: 'J',
    color: '#D49B3E',
    age: 33,
  },
  cole: {
    id: 'cole',
    name: 'Cole',
    relationship: 'Stepbrother',
    initials: 'C',
    color: '#5C9E8C',
    age: 29,
  },
};

// ---- BRANCHES ----------------------------------------------------------------

export type BranchId = 'pilks' | 'stepfamily';

export interface Branch {
  id: BranchId;
  name: string;
  shortName: string;
  memberIds: MemberId[]; // includes 'me'
  color: string;
  memoryCount: number;
  // optional = only shown when user has joined / created a 2nd branch.
  // Real app: branches just exist; you have them or you don't. Demo: a toggle reveals one.
  optional?: boolean;
}

export const BRANCHES: Record<BranchId, Branch> = {
  pilks: {
    id: 'pilks',
    name: 'The Pilks',
    shortName: 'The Pilks',
    memberIds: ['me', 'mom', 'dad', 'mike', 'grace'],
    color: '#C0345C',
    memoryCount: 47,
  },
  stepfamily: {
    id: 'stepfamily',
    name: 'The Smiths',
    shortName: 'The Smiths',
    memberIds: ['me', 'dad', 'jake', 'cole'],
    color: '#2E8B57',
    memoryCount: 18,
    optional: true,
  },
};

// Default branch list — single family. Demo toggle adds the second branch.
export const BRANCH_LIST: Branch[] = [BRANCHES.pilks];
export const ALL_BRANCHES: Branch[] = [BRANCHES.pilks, BRANCHES.stepfamily];

// People *other than you* in a branch
export function membersOf(branchId: BranchId): Member[] {
  return BRANCHES[branchId].memberIds.filter((id) => id !== 'me').map((id) => MEMBERS[id]);
}

// ---- FEED ITEMS --------------------------------------------------------------

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
  // The fan-out: which timelines this item lives in
  appearsIn: string[];
}

export const FEED: FeedItem[] = [
  {
    id: '1',
    branchId: 'pilks',
    authorId: 'mom',
    kind: 'answer',
    body: 'I used to put butter on them. Just butter. Your grandfather would lose his mind because he thought it was wasteful, but I loved it.',
    mediaKind: 'voice',
    mediaCaption: 'Voice answer — Mom',
    durationSec: 47,
    relatedToName: 'Aaron',
    visibility: 'just_us',
    topic: 'Food',
    reactions: 3,
    comments: 1,
    whenAgo: '2h ago',
    appearsIn: ["Mom's timeline", 'You ↔ Mom', 'Food'],
  },
  {
    id: '2',
    branchId: 'pilks',
    authorId: 'mike',
    kind: 'post',
    body: "Throwback to last Christmas. Mom's face when she saw the gift.",
    mediaKind: 'photo',
    photoTint: '#D4DDC4',
    visibility: 'family',
    topic: 'Holidays',
    reactions: 6,
    comments: 2,
    whenAgo: '1w ago',
    appearsIn: ["Mike's timeline", 'The Pilks', 'Holidays'],
  },
  {
    id: '3',
    branchId: 'pilks',
    authorId: 'grace',
    kind: 'answer',
    body: 'The first time I held you, I cried for an hour. Your mother thought something was wrong with me. Nothing was wrong. You were just so small.',
    mediaKind: 'video',
    mediaCaption: 'Video answer — Grandma',
    durationSec: 92,
    relatedToName: 'Aaron',
    visibility: 'just_us',
    topic: 'Love',
    reactions: 7,
    comments: 2,
    whenAgo: '3d ago',
    appearsIn: ["Grandma's timeline", 'You ↔ Grandma', 'Love'],
  },
  {
    id: '4',
    branchId: 'pilks',
    authorId: 'mom',
    kind: 'post',
    body: "Recipe from your great-grandmother. I want this written down somewhere it won't get lost.",
    mediaKind: 'photo',
    photoTint: '#F5E6D3',
    visibility: 'family',
    topic: 'Recipes',
    reactions: 4,
    comments: 3,
    whenAgo: '4d ago',
    appearsIn: ["Mom's timeline", 'The Pilks', 'Recipes'],
  },
  {
    id: '5',
    branchId: 'pilks',
    authorId: 'dad',
    kind: 'answer',
    body: 'Bruce Springsteen, mostly. Born to Run on repeat. Some Tom Petty. Your uncle had Pink Floyd albums I borrowed without asking.',
    mediaKind: 'text',
    relatedToName: 'Aaron',
    visibility: 'just_us',
    topic: 'Music',
    reactions: 2,
    comments: 1,
    whenAgo: '1w ago',
    appearsIn: ["Dad's timeline", 'You ↔ Dad', 'Music'],
  },
  {
    id: '6',
    branchId: 'pilks',
    authorId: 'dad',
    kind: 'post',
    body: 'Found this in a box in the garage. 1987. Look at that bowl cut.',
    mediaKind: 'photo',
    photoTint: '#E8D5C4',
    visibility: 'family',
    topic: 'Childhood',
    reactions: 5,
    comments: 4,
    whenAgo: 'yesterday',
    appearsIn: ["Dad's timeline", 'The Pilks', 'Childhood'],
  },
  // Lives only in the optional stepfamily branch
  {
    id: '7',
    branchId: 'stepfamily',
    authorId: 'jake',
    kind: 'post',
    body: 'Cole, remember when we taught Aaron how to fish? He almost fell in twice.',
    mediaKind: 'text',
    visibility: 'family',
    topic: 'Funny stories',
    reactions: 3,
    comments: 1,
    whenAgo: '2w ago',
    appearsIn: ["Jake's timeline", 'The Smiths', 'Funny stories'],
  },
];

export function feedForBranch(branchId: BranchId): FeedItem[] {
  return FEED.filter((f) => f.branchId === branchId);
}

// ---- TODAY PROMPTS -----------------------------------------------------------

export interface TodayPrompt {
  id: string;
  prompt: string;
  source: 'ai' | 'curated' | 'family';
  fromName?: string;
}

export const TODAY_PROMPTS: Record<BranchId, TodayPrompt> = {
  pilks: {
    id: 't1',
    prompt: 'What was a snack you ate as a kid that your kids have never tried?',
    source: 'curated',
  },
  stepfamily: {
    id: 't2',
    prompt: "What's a song from your teens that always brings you back?",
    source: 'curated',
  },
};

// ---- INBOX (questions OTHERS asked YOU) -------------------------------------

export interface InboxQuestion {
  id: string;
  branchId: BranchId;
  fromId: MemberId;
  body: string;
  whenAgo: string;
}

export const INBOX: InboxQuestion[] = [
  {
    id: 'q1',
    branchId: 'pilks',
    fromId: 'mom',
    body: 'What was the name of the cat we had when you were 6? Mike says Whiskers, I say Tigger.',
    whenAgo: '1h ago',
  },
  {
    id: 'q2',
    branchId: 'pilks',
    fromId: 'grace',
    body: 'Tell me what your kids are into right now. I want to know.',
    whenAgo: 'yesterday',
  },
  {
    id: 'q3',
    branchId: 'pilks',
    fromId: 'dad',
    body: "What's the best advice I ever gave you that actually worked?",
    whenAgo: '3d ago',
  },
  {
    id: 'q4',
    branchId: 'stepfamily',
    fromId: 'jake',
    body: 'What was your favorite day from any of our summers up at the lake?',
    whenAgo: '2d ago',
  },
];

export function inboxForBranch(branchId: BranchId): InboxQuestion[] {
  return INBOX.filter((q) => q.branchId === branchId);
}

// ---- SUGGESTED QUESTIONS -----------------------------------------------------

export const SUGGESTED_QUESTIONS: { branchId: BranchId; ask: MemberId; text: string }[] = [
  { branchId: 'pilks', ask: 'mom', text: 'What was the first meal you cooked on your own?' },
  { branchId: 'pilks', ask: 'grace', text: 'Tell me about the day Mom was born.' },
  { branchId: 'pilks', ask: 'dad', text: "What did you think you'd be when you were my age?" },
  { branchId: 'pilks', ask: 'mom', text: "What's the bravest thing you've ever done?" },
  { branchId: 'stepfamily', ask: 'jake', text: "What's your earliest memory of meeting me?" },
];

// ---- VAULT -------------------------------------------------------------------

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

export const VAULT: VaultItem[] = [
  {
    id: 'v1',
    creatorId: 'me',
    title: 'For Sara, when she becomes a mother',
    releaseText: "Releases on Sara's first child",
    recipientIds: ['me'],
    mediaKind: 'video',
    durationSec: 184,
    status: 'sealed',
  },
  {
    id: 'v2',
    creatorId: 'me',
    title: 'Letter to my future self',
    releaseText: 'Releases on Jan 1, 2030',
    recipientIds: ['me'],
    mediaKind: 'text',
    status: 'scheduled',
  },
  {
    id: 'v3',
    creatorId: 'me',
    title: 'For Mike on his 50th',
    releaseText: "Releases on Mike's 50th birthday — Aug 14, 2038",
    recipientIds: ['mike'],
    mediaKind: 'voice',
    durationSec: 65,
    status: 'scheduled',
  },
  {
    id: 'v4',
    creatorId: 'me',
    title: "Sara's college fund",
    releaseText: "Releases on Sara's college graduation",
    recipientIds: ['me'],
    mediaKind: 'money',
    amountUsd: 25000,
    status: 'scheduled',
  },
  {
    id: 'v5',
    creatorId: 'me',
    title: 'Things I never told you',
    releaseText: 'Releases after my passing (verified by 2 family members)',
    recipientIds: ['mike'],
    mediaKind: 'video',
    durationSec: 320,
    status: 'sealed',
  },
];

// ---- TOPICS ------------------------------------------------------------------

export const TOPICS = [
  { slug: 'food', label: 'Food', count: 12 },
  { slug: 'childhood', label: 'Childhood', count: 9 },
  { slug: 'love', label: 'Love', count: 6 },
  { slug: 'advice', label: 'Advice', count: 5 },
  { slug: 'holidays', label: 'Holidays', count: 8 },
  { slug: 'music', label: 'Music', count: 4 },
  { slug: 'lessons', label: 'Lessons', count: 3 },
  { slug: 'recipes', label: 'Recipes', count: 7 },
  { slug: 'funny_stories', label: 'Funny', count: 5 },
  { slug: 'photo_books', label: 'Photo books', count: 2 },
];

// ---- PHOTO BOOKS (digitized analog albums) -----------------------------------

export interface PhotoBook {
  id: string;
  title: string;
  ownerId: MemberId;
  pageCount: number;
  status: 'capturing' | 'processing' | 'ready';
  coverTint: string;
  yearRange: string;
}

export const PHOTO_BOOKS: PhotoBook[] = [
  {
    id: 'pb1',
    title: "Grandma's wedding album",
    ownerId: 'grace',
    pageCount: 84,
    status: 'ready',
    coverTint: '#D8C7CC',
    yearRange: '1962',
  },
  {
    id: 'pb2',
    title: 'Family vacations 1988–1995',
    ownerId: 'mom',
    pageCount: 142,
    status: 'processing',
    coverTint: '#E8D5C4',
    yearRange: '1988–95',
  },
];

// ---- FAMILY MOMENTS (events + planning + voting) ----------------------------

export type MomentStatus = 'planning' | 'upcoming' | 'happening' | 'past';

export interface PollOption {
  id: string;
  label: string;
  subtitle?: string;
  tint?: string;
  /** Widened to AnyMemberId so events can include extended-family votes. */
  votes: AnyMemberId[];
}

export interface PackingItem {
  id: string;
  item: string;
  assigneeId?: MemberId;
  checked: boolean;
}

export interface MomentMessage {
  id: string;
  authorId: MemberId;
  body: string;
  whenAgo: string;
  /** Optional ISO timestamp — when present, the chat UI uses it for date separators. */
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
  coverGlyph: string; // emoji stand-in for hero art
  organizerId: MemberId;
  participantIds: MemberId[];
  datePoll?: PollOption[];
  locationPoll?: PollOption[];
  packingList?: PackingItem[];
  activity: MomentMessage[];
}

export const MOMENTS: FamilyMoment[] = [
  {
    id: 'tahoe',
    branchId: 'pilks',
    title: 'Tahoe family week',
    subtitle: 'Annual cabin trip — Pilks',
    status: 'planning',
    dateRangeText: 'Aug 14 – 21, 2026',
    coverTint: '#9BC7E4',
    coverGlyph: '🏔',
    organizerId: 'mom',
    participantIds: ['me', 'mom', 'dad', 'mike', 'grace'],
    datePoll: [
      { id: 'd1', label: 'Aug 7 – 14', votes: ['mike'] },
      { id: 'd2', label: 'Aug 14 – 21', votes: ['me', 'mom', 'dad', 'grace'] },
      { id: 'd3', label: 'Aug 21 – 28', votes: [] },
    ],
    locationPoll: [
      {
        id: 'l1',
        label: 'Lakefront cabin · 4BR',
        subtitle: '$420/night · sleeps 8 · pier',
        tint: '#9BC7E4',
        votes: ['me', 'mom', 'mike'],
      },
      {
        id: 'l2',
        label: 'Tahoe vista lodge',
        subtitle: '$340/night · sleeps 10 · hot tub',
        tint: '#C3D8B5',
        votes: ['dad', 'grace'],
      },
      {
        id: 'l3',
        label: 'Cozy A-frame',
        subtitle: '$280/night · sleeps 6 · walk to town',
        tint: '#E8C8B0',
        votes: [],
      },
    ],
    packingList: [
      { id: 'p1', item: 'Bring the good coffee', assigneeId: 'me', checked: true },
      { id: 'p2', item: 'Board games', assigneeId: 'mike', checked: false },
      { id: 'p3', item: "Grandma's recipe box", assigneeId: 'mom', checked: false },
      { id: 'p4', item: 'Fishing gear', assigneeId: 'dad', checked: true },
      { id: 'p5', item: 'Disposable cameras (3)', assigneeId: 'me', checked: false },
    ],
    activity: [
      {
        id: 'a1',
        authorId: 'mom',
        body: 'Found that lakefront cabin again — same one from 2014!',
        whenAgo: '2d ago',
      },
      { id: 'a2', authorId: 'mike', body: 'I can fly in Friday night.', whenAgo: '2d ago' },
      {
        id: 'a3',
        authorId: 'dad',
        body: 'Bringing the fishing gear. Pier is the dream.',
        whenAgo: '1d ago',
      },
      {
        id: 'a4',
        authorId: 'me',
        body: "I'll grab disposable cameras so we have prints after.",
        whenAgo: '4h ago',
      },
    ],
  },
  {
    id: 'thanksgiving',
    branchId: 'pilks',
    title: "Thanksgiving at Grandma's",
    subtitle: 'The whole Pilks crew',
    status: 'upcoming',
    dateRangeText: 'Nov 26 – 29, 2026',
    coverTint: '#E8B274',
    coverGlyph: '🍂',
    organizerId: 'grace',
    participantIds: ['me', 'mom', 'dad', 'mike', 'grace'],
    activity: [
      {
        id: 'b1',
        authorId: 'grace',
        body: "I'll do the turkey. Everyone else picks a side.",
        whenAgo: '1w ago',
      },
    ],
  },
];

export function momentsForBranches(branchIds: BranchId[]): FamilyMoment[] {
  return MOMENTS.filter((m) => branchIds.includes(m.branchId));
}

// ---- LABELS ------------------------------------------------------------------

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  just_us: 'Just us',
  family: 'Branch',
  only_me: 'Only me',
  vault: 'Vault',
};

// Per-member memory counts (just for the demo profile screen)
export const MEMORIES_WITH: Record<MemberId, number> = {
  me: 0,
  mom: 62,
  dad: 18,
  mike: 27,
  grace: 41,
  jake: 9,
  cole: 6,
};

// ---- IMMEDIATE FAMILY DESIGNATION -------------------------------------------
// Per the kin-event-mode plan: each user declares their immediate family at
// onboarding. For Aaron: Mom, Dad, Brother (Mike), Grandma (Grace), plus the
// stepbrothers via Dad's side. NOT cousins. This is a per-viewer designation —
// see family_memberships.is_immediate in the schema.

export const IMMEDIATE_FAMILY_IDS: Set<MemberId> = new Set<MemberId>([
  'mom',
  'dad',
  'mike',
  'grace',
  // Stepbrothers count as immediate when Aaron's blended-family branch is on;
  // the family tab UI filters by current branch so this just controls the
  // master list of "could be immediate" people.
  'jake',
  'cole',
]);

export function isImmediate(id: MemberId): boolean {
  return IMMEDIATE_FAMILY_IDS.has(id);
}

// ---- EXTENDED FAMILY --------------------------------------------------------

export const EXTENDED_MEMBERS: Record<ExtendedMemberId, ExtendedMember> = {
  aunt_susan: {
    id: 'aunt_susan',
    name: 'Susan',
    relationship: "Mom's sister",
    initials: 'S',
    color: '#A85D3E',
    age: 60,
    branchId: 'pilks',
  },
  uncle_pete: {
    id: 'uncle_pete',
    name: 'Pete',
    relationship: "Mom's brother",
    initials: 'P',
    color: '#4B6FA8',
    age: 58,
    branchId: 'pilks',
  },
  cousin_sara: {
    id: 'cousin_sara',
    name: 'Sara',
    relationship: 'Cousin',
    initials: 'S',
    color: '#C97A8E',
    age: 26,
    branchId: 'pilks',
  },
  cousin_emma: {
    id: 'cousin_emma',
    name: 'Emma',
    relationship: 'Cousin',
    initials: 'E',
    color: '#7AB4A8',
    age: 22,
    branchId: 'pilks',
  },
  cousin_ben: {
    id: 'cousin_ben',
    name: 'Ben',
    relationship: 'Cousin',
    initials: 'B',
    color: '#9F8AC3',
    age: 19,
    branchId: 'pilks',
  },
  aunt_diane: {
    id: 'aunt_diane',
    name: 'Diane',
    relationship: "Dad's sister",
    initials: 'D',
    color: '#D08A4B',
    age: 61,
    branchId: 'stepfamily',
  },
  gramp_hal: {
    id: 'gramp_hal',
    name: 'Hal',
    relationship: 'Grandpa (Dad side)',
    initials: 'H',
    color: '#6B7C5B',
    age: 88,
    branchId: 'stepfamily',
  },
  mike_partner: {
    id: 'mike_partner',
    name: 'Rachel',
    relationship: "Mike's partner",
    initials: 'R',
    color: '#B8704F',
    age: 36,
    branchId: 'pilks',
  },
  jake_partner: {
    id: 'jake_partner',
    name: 'Nora',
    relationship: "Jake's partner",
    initials: 'N',
    color: '#5C8FA8',
    age: 32,
    branchId: 'stepfamily',
  },
  family_friend_ruth: {
    id: 'family_friend_ruth',
    name: 'Ruth',
    relationship: 'Family friend (40 years)',
    initials: 'R',
    color: '#8C6C99',
    age: 71,
    branchId: 'pilks',
    metAtEvent: true,
  },
};

export function getAnyMember(id: AnyMemberId): {
  name: string;
  initials: string;
  color: string;
  relationship: string;
} {
  if (id in MEMBERS) return MEMBERS[id as MemberId];
  return EXTENDED_MEMBERS[id as ExtendedMemberId];
}

// ---- EVENTS / REUNIONS (Reunion Mode v0) ------------------------------------
// Builds on the existing FamilyMoment but adds: cross-branch, RSVPs, extended
// guests, scoped photo/video feed, highlight reel stub.

export type EventKind = 'reunion' | 'vacation' | 'holiday' | 'gathering' | 'other';
export type EventRsvp = 'invited' | 'going' | 'maybe' | 'no';

export interface EventGuest {
  memberId: AnyMemberId;
  rsvp: EventRsvp;
  isHost?: boolean;
  /** True for invited people who haven't installed the app yet (event-only). */
  pendingInvite?: boolean;
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
  branchIds: BranchId[]; // cross-branch: e.g. ['pilks', 'stepfamily']
  kind: EventKind;
  title: string;
  subtitle: string;
  dateRangeText: string;
  startsAt: string; // ISO yyyy-mm-dd for sorting / countdown
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

// Helper to count guests by RSVP
export function rsvpCount(event: FamilyEvent, status: EventRsvp): number {
  return event.guests.filter((g) => g.rsvp === status).length;
}

export const EVENTS: FamilyEvent[] = [
  {
    id: 'pilks-reunion-2026',
    branchIds: ['pilks', 'stepfamily'],
    kind: 'reunion',
    title: 'Pilks Family Reunion',
    subtitle: 'Three generations · Pilks & extended',
    dateRangeText: 'Jul 17 – 20, 2026',
    startsAt: '2026-07-17',
    endsAt: '2026-07-20',
    status: 'upcoming',
    coverTint: '#E8B274',
    coverGlyph: '🌾',
    locationText: "Aunt Susan's place · Hudson Valley, NY",
    organizerId: 'mom',
    guests: [
      // Immediate family — all Going
      { memberId: 'me', rsvp: 'going' },
      { memberId: 'mom', rsvp: 'going', isHost: true },
      { memberId: 'dad', rsvp: 'going' },
      { memberId: 'mike', rsvp: 'going' },
      { memberId: 'grace', rsvp: 'going' },
      // Extended Pilks side
      { memberId: 'aunt_susan', rsvp: 'going', isHost: true },
      { memberId: 'uncle_pete', rsvp: 'going' },
      { memberId: 'cousin_sara', rsvp: 'going' },
      { memberId: 'cousin_emma', rsvp: 'maybe' },
      { memberId: 'cousin_ben', rsvp: 'going' },
      { memberId: 'mike_partner', rsvp: 'going' },
      // Stepfamily side (cross-branch — only here because reunion mixes branches)
      { memberId: 'jake', rsvp: 'maybe' },
      { memberId: 'cole', rsvp: 'going' },
      { memberId: 'aunt_diane', rsvp: 'going', pendingInvite: true },
      { memberId: 'gramp_hal', rsvp: 'maybe', pendingInvite: true },
      { memberId: 'jake_partner', rsvp: 'invited' },
      // Family friend
      { memberId: 'family_friend_ruth', rsvp: 'going', pendingInvite: true },
    ],
    bringList: [
      { id: 'b1', item: "Grandma's lasagna (double batch)", assigneeId: 'mom', checked: false },
      { id: 'b2', item: 'Yard games — cornhole, bocce', assigneeId: 'me', checked: true },
      { id: 'b3', item: 'Cooler full of drinks', assigneeId: 'mike', checked: false },
      { id: 'b4', item: 'Polaroid camera + 3 packs of film', assigneeId: 'me', checked: true },
      { id: 'b5', item: 'Folding chairs (6)', assigneeId: 'dad', checked: false },
      { id: 'b6', item: "Susan's peach cobbler", checked: false },
      { id: 'b7', item: 'Speaker + dad-rock playlist', checked: false },
      { id: 'b8', item: 'Sunscreen for the kids', checked: false },
    ],
    polls: {
      activity: [
        {
          id: 'a1',
          label: 'Saturday afternoon hike',
          subtitle: 'Easy 3mi loop · everyone can join',
          tint: '#9BC97A',
          votes: ['me', 'mom', 'mike', 'cousin_ben'],
        },
        {
          id: 'a2',
          label: 'Lake day — swim + paddleboards',
          subtitle: 'Pack a picnic',
          tint: '#9BC7E4',
          votes: ['cousin_sara', 'cousin_emma', 'mike_partner'],
        },
        {
          id: 'a3',
          label: 'Old family slideshow night',
          subtitle: 'Susan will dig out the projector',
          tint: '#C0345C',
          votes: ['mom', 'grace', 'dad', 'aunt_susan', 'uncle_pete'],
        },
        {
          id: 'a4',
          label: "Backyard movie + s'mores",
          subtitle: 'Friday night kickoff',
          tint: '#E8B274',
          votes: ['me', 'cole', 'cousin_ben'],
        },
      ],
    },
    activity: [
      {
        id: 'r1',
        authorId: 'mom',
        body: "Susan said she's clearing her back field — bring lawn games and we can run cornhole all weekend.",
        whenAgo: 'Mon',
        at: '2026-05-18T10:12:00Z',
      },
      {
        id: 'r2',
        authorId: 'mike',
        body: "I'll bring the drinks if Aaron handles the games.",
        whenAgo: 'Mon',
        at: '2026-05-18T11:04:00Z',
      },
      {
        id: 'r3',
        authorId: 'me',
        body: 'Deal. Already got cornhole + bocce checked off the list.',
        whenAgo: 'Tue',
        at: '2026-05-19T15:22:00Z',
      },
      {
        id: 'r4',
        authorId: 'grace',
        body: "I haven't seen Diane in nine years. This is going to be something.",
        whenAgo: 'Wed',
        at: '2026-05-20T19:40:00Z',
      },
      {
        id: 'r5',
        authorId: 'mom',
        body: 'Pete confirmed — he and the kids are driving up Thursday night.',
        whenAgo: '6:20 AM',
        at: '2026-05-21T10:20:00Z',
      },
      {
        id: 'r6',
        authorId: 'me',
        body: "Nice. Anyone need a ride up from the city? I've got the SUV.",
        whenAgo: '7:55 AM',
        at: '2026-05-21T11:55:00Z',
      },
      {
        id: 'r7',
        authorId: 'mike',
        body: "I'm flying in Friday morning. Could use a lift from the airport if you're around.",
        whenAgo: '8:02 AM',
        at: '2026-05-21T12:02:00Z',
      },
      {
        id: 'r8',
        authorId: 'me',
        body: 'Done. Text me the flight info.',
        whenAgo: '8:04 AM',
        at: '2026-05-21T12:04:00Z',
      },
      {
        id: 'r9',
        authorId: 'grace',
        body: "Will there be coffee in the morning? I'm useless without it.",
        whenAgo: '9:12 AM',
        at: '2026-05-21T13:12:00Z',
      },
      {
        id: 'r10',
        authorId: 'mom',
        body: "Mom, of course there will be coffee. We're not animals.",
        whenAgo: '9:14 AM',
        at: '2026-05-21T13:14:00Z',
      },
      {
        id: 'r11',
        authorId: 'dad',
        body: 'Is there parking at the barn or are we doing the field?',
        whenAgo: '11:30 AM',
        at: '2026-05-21T15:30:00Z',
      },
      {
        id: 'r12',
        authorId: 'mom',
        body: 'Susan said field on Friday/Saturday, barn lot on Sunday. Watch for cones.',
        whenAgo: '11:33 AM',
        at: '2026-05-21T15:33:00Z',
      },
    ],
    photos: [
      // A few preview photos uploaded during planning ("excited" pics).
      {
        id: 'rp1',
        authorId: 'mom',
        tint: '#F5E6D3',
        caption: 'Found this from the last reunion in 2017. Look at us all.',
        whenAgo: '4d ago',
        mediaKind: 'photo',
        reactions: 9,
      },
      {
        id: 'rp2',
        authorId: 'aunt_susan',
        tint: '#D4DDC4',
        caption: 'The barn is ready. Cleaned it out today!',
        whenAgo: '1d ago',
        mediaKind: 'photo',
        reactions: 6,
      },
    ],
    // Highlights remain empty until status = 'past'.
  },
  {
    id: 'tahoe',
    branchIds: ['pilks'],
    kind: 'vacation',
    title: 'Tahoe family week',
    subtitle: 'Annual cabin trip — Pilks',
    dateRangeText: 'Aug 14 – 21, 2026',
    startsAt: '2026-08-14',
    endsAt: '2026-08-21',
    status: 'planning',
    coverTint: '#9BC7E4',
    coverGlyph: '🏔',
    locationText: 'Lake Tahoe, CA',
    organizerId: 'mom',
    guests: [
      { memberId: 'me', rsvp: 'going' },
      { memberId: 'mom', rsvp: 'going', isHost: true },
      { memberId: 'dad', rsvp: 'going' },
      { memberId: 'mike', rsvp: 'going' },
      { memberId: 'grace', rsvp: 'going' },
    ],
    bringList: [
      { id: 'tp1', item: 'Bring the good coffee', assigneeId: 'me', checked: true },
      { id: 'tp2', item: 'Board games', assigneeId: 'mike', checked: false },
      { id: 'tp3', item: "Grandma's recipe box", assigneeId: 'mom', checked: false },
      { id: 'tp4', item: 'Fishing gear', assigneeId: 'dad', checked: true },
      { id: 'tp5', item: 'Disposable cameras (3)', assigneeId: 'me', checked: false },
    ],
    polls: {
      date: [
        { id: 'td1', label: 'Aug 7 – 14', votes: ['mike'] },
        { id: 'td2', label: 'Aug 14 – 21', votes: ['me', 'mom', 'dad', 'grace'] },
        { id: 'td3', label: 'Aug 21 – 28', votes: [] },
      ],
      location: [
        {
          id: 'tl1',
          label: 'Lakefront cabin · 4BR',
          subtitle: '$420/night · sleeps 8 · pier',
          tint: '#9BC7E4',
          votes: ['me', 'mom', 'mike'],
        },
        {
          id: 'tl2',
          label: 'Tahoe vista lodge',
          subtitle: '$340/night · sleeps 10 · hot tub',
          tint: '#C3D8B5',
          votes: ['dad', 'grace'],
        },
        {
          id: 'tl3',
          label: 'Cozy A-frame',
          subtitle: '$280/night · sleeps 6 · walk to town',
          tint: '#E8C8B0',
          votes: [],
        },
      ],
    },
    activity: [
      {
        id: 'ta1',
        authorId: 'mom',
        body: 'Found that lakefront cabin again — same one from 2014!',
        whenAgo: '2d ago',
      },
      { id: 'ta2', authorId: 'mike', body: 'I can fly in Friday night.', whenAgo: '2d ago' },
      {
        id: 'ta3',
        authorId: 'dad',
        body: 'Bringing the fishing gear. Pier is the dream.',
        whenAgo: '1d ago',
      },
      {
        id: 'ta4',
        authorId: 'me',
        body: "I'll grab disposable cameras so we have prints after.",
        whenAgo: '4h ago',
      },
    ],
    photos: [],
  },
  {
    id: 'last-summer-bbq',
    branchIds: ['pilks'],
    kind: 'gathering',
    title: 'Backyard summer BBQ',
    subtitle: "Mom's birthday weekend, 2025",
    dateRangeText: 'Jul 11 – 13, 2025',
    startsAt: '2025-07-11',
    endsAt: '2025-07-13',
    status: 'past',
    coverTint: '#C3D8B5',
    coverGlyph: '🌻',
    locationText: 'The backyard',
    organizerId: 'mom',
    guests: [
      { memberId: 'me', rsvp: 'going' },
      { memberId: 'mom', rsvp: 'going', isHost: true },
      { memberId: 'dad', rsvp: 'going' },
      { memberId: 'mike', rsvp: 'going' },
      { memberId: 'grace', rsvp: 'going' },
      { memberId: 'aunt_susan', rsvp: 'going' },
      { memberId: 'mike_partner', rsvp: 'going' },
    ],
    bringList: [],
    polls: {},
    activity: [],
    photos: [
      {
        id: 'lp1',
        authorId: 'mom',
        tint: '#E8B274',
        caption: 'Grace blowing out 84 candles. Took three tries.',
        whenAgo: 'Jul 2025',
        mediaKind: 'photo',
        reactions: 14,
      },
      {
        id: 'lp2',
        authorId: 'mike',
        tint: '#C0345C',
        caption: 'Dad on the grill, classic.',
        whenAgo: 'Jul 2025',
        mediaKind: 'photo',
        reactions: 8,
      },
      {
        id: 'lp3',
        authorId: 'me',
        tint: '#9BC97A',
        caption: 'Aaron and Sara argued about whether the burgers were done. Sara won.',
        whenAgo: 'Jul 2025',
        mediaKind: 'photo',
        reactions: 11,
      },
    ],
    highlights: [
      {
        kind: 'quote',
        body: '"Eighty-four years and I still can\'t blow out candles in one go."',
        authorId: 'grace',
      },
      {
        kind: 'photo',
        photoId: 'lp1',
        body: 'Grace and her 84 candles',
      },
      {
        kind: 'top_chatter',
        body: 'Sara and Aaron argued about burger doneness for 22 minutes straight.',
      },
    ],
  },
];

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

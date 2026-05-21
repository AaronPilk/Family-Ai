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

export interface Member {
  id: MemberId;
  name: string;
  relationship: string;
  initials: string;
  color: string;
  age?: number;
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
  votes: MemberId[];
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

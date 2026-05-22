/**
 * Supabase data layer for the family-graph feature.
 *
 * Three concerns:
 *   - fetch the user's family from their primary circle, split into immediate
 *     (inner-ring) and extended (outer-ring grouped by branch);
 *   - return the set of untagged members so the Family tab can queue the
 *     "Who is this to you?" prompt;
 *   - call the tag_family_relationship RPC when the user picks a label.
 *
 * Read patterns mirror supabaseLetters/supabaseVault: small denormalised
 * queries, no Postgres joins (because the FK from family_memberships.user_id
 * to public.profiles isn't a foreign key from PostgREST's view), profile names
 * fetched in a second IN(...) query.
 */

import { supabase } from './supabase';

// ---- Types ------------------------------------------------------------------

export interface FamilyMember {
  userId: string;
  displayName: string;
  avatarColor: string;
  initials: string;
  isImmediate: boolean;
  invitedViaUserId: string | null;
  relationshipType: string | null; // label the viewer has tagged on them
}

export interface FamilyBranch {
  viaUserId: string;
  branchName: string;
  memberCount: number;
  members: FamilyMember[];
}

export interface FamilyGraph {
  circleId: string | null;
  immediate: FamilyMember[];
  branches: FamilyBranch[];
  // Members in the circle whose row has is_immediate=false AND for whom the
  // caller hasn't created a relationships row. Queued by the Family tab for
  // the "Who is this to you?" modal.
  untagged: FamilyMember[];
}

export class SupabaseFamilyError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SupabaseFamilyError';
    this.cause = cause;
  }
}

// ---- Helpers ----------------------------------------------------------------

const COLOR_PALETTE = [
  '#C0345C',
  '#7A5BAF',
  '#3C8A6E',
  '#D17A2E',
  '#2F6BA6',
  '#9A4A8C',
  '#4A6E3E',
  '#B85C3E',
];

function colorFor(userId: string): string {
  // Stable hash → palette index. Same display every render.
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return COLOR_PALETTE[h % COLOR_PALETTE.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) {
    throw new SupabaseFamilyError('You must be signed in.');
  }
  return uid;
}

async function primaryCircleId(uid: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('family_memberships')
    .select('circle_id, joined_at')
    .eq('user_id', uid)
    .is('removed_at', null)
    .order('joined_at', { ascending: true })
    .limit(1);

  if (error) {
    throw new SupabaseFamilyError('Could not find your family circle.', error);
  }
  return (data?.[0]?.circle_id as string | undefined) ?? null;
}

// ---- Reads ------------------------------------------------------------------

/**
 * Fetch the full family graph for the current user's primary circle.
 *
 * Shape:
 *   - immediate: members with is_immediate = true (excluding the caller)
 *   - branches: extended members grouped by invited_via_user_id
 *   - untagged: extended members the caller hasn't tagged yet
 */
export async function fetchMyFamily(): Promise<FamilyGraph> {
  const uid = await currentUserId();
  const circleId = await primaryCircleId(uid);
  if (!circleId) {
    return { circleId: null, immediate: [], branches: [], untagged: [] };
  }

  // 1. All other active members of this circle.
  const { data: memRows, error: memErr } = await supabase
    .from('family_memberships')
    .select('user_id, is_immediate, invited_via_user_id, joined_at')
    .eq('circle_id', circleId)
    .neq('user_id', uid)
    .is('removed_at', null)
    .order('joined_at', { ascending: true });

  if (memErr) {
    throw new SupabaseFamilyError('Could not load family members.', memErr);
  }
  const rows = (memRows ?? []) as Array<{
    user_id: string;
    is_immediate: boolean;
    invited_via_user_id: string | null;
    joined_at: string;
  }>;

  if (rows.length === 0) {
    return { circleId, immediate: [], branches: [], untagged: [] };
  }

  // 2. Profiles for everyone (members + branch via-users, deduped).
  const allIds = new Set<string>();
  for (const r of rows) {
    allIds.add(r.user_id);
    if (r.invited_via_user_id) allIds.add(r.invited_via_user_id);
  }
  const idList = Array.from(allIds);

  const { data: profRows, error: profErr } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', idList);

  if (profErr) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseFamily] profile lookup failed:', profErr.message);
  }
  const nameMap = new Map<string, string>();
  for (const p of profRows ?? []) {
    nameMap.set(p.user_id as string, (p.display_name as string) || 'Family member');
  }

  // 3. Relationships the caller has already tagged on members in this circle.
  const { data: relRows, error: relErr } = await supabase
    .from('relationships')
    .select('to_user_id, relationship_type')
    .eq('circle_id', circleId)
    .eq('from_user_id', uid);

  if (relErr) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseFamily] relationships lookup failed:', relErr.message);
  }
  const relMap = new Map<string, string>();
  for (const r of relRows ?? []) {
    relMap.set(r.to_user_id as string, r.relationship_type as string);
  }

  // Build member objects.
  const members: FamilyMember[] = rows.map((r) => {
    const displayName = nameMap.get(r.user_id) ?? 'Family member';
    return {
      userId: r.user_id,
      displayName,
      avatarColor: colorFor(r.user_id),
      initials: initialsOf(displayName),
      isImmediate: r.is_immediate,
      invitedViaUserId: r.invited_via_user_id,
      relationshipType: relMap.get(r.user_id) ?? null,
    };
  });

  // Split.
  const immediate = members.filter((m) => m.isImmediate);
  const extended = members.filter((m) => !m.isImmediate);

  // Branch grouping client-side (we could call extended_family_branches RPC,
  // but we already have the rows in memory and need the per-branch members
  // anyway).
  const branchesMap = new Map<string, FamilyMember[]>();
  for (const m of extended) {
    const key = m.invitedViaUserId ?? '__orphan__';
    const list = branchesMap.get(key) ?? [];
    list.push(m);
    branchesMap.set(key, list);
  }
  const branches: FamilyBranch[] = Array.from(branchesMap.entries())
    .map(([viaUserId, list]) => ({
      viaUserId,
      branchName:
        viaUserId === '__orphan__'
          ? 'Other'
          : nameMap.get(viaUserId) ?? 'Family member',
      memberCount: list.length,
      members: list,
    }))
    .sort((a, b) => b.memberCount - a.memberCount);

  // Untagged: extended members without a relationship row from the caller.
  const untagged = extended.filter((m) => !m.relationshipType);

  return { circleId, immediate, branches, untagged };
}

// ---- Writes -----------------------------------------------------------------

export type RelationshipType =
  | 'parent'
  | 'child'
  | 'grandparent'
  | 'grandchild'
  | 'sibling'
  | 'spouse'
  | 'aunt_uncle'
  | 'niece_nephew'
  | 'cousin'
  | 'in_law'
  | 'chosen_family'
  | 'family_friend'
  | 'custom';

/**
 * Inner-ring labels — labels that flip is_immediate = true.
 */
export const IMMEDIATE_RELATIONSHIP_TYPES: ReadonlySet<RelationshipType> = new Set([
  'parent',
  'child',
  'grandparent',
  'grandchild',
  'sibling',
  'spouse',
]);

/**
 * Human-readable label and short description for each relationship type.
 * Used by the "Who is this to you?" picker.
 */
export const RELATIONSHIP_LABELS: Array<{
  type: RelationshipType;
  label: string;
  isImmediate: boolean;
}> = [
  { type: 'parent', label: 'Parent', isImmediate: true },
  { type: 'child', label: 'Child', isImmediate: true },
  { type: 'sibling', label: 'Sibling', isImmediate: true },
  { type: 'spouse', label: 'Spouse / partner', isImmediate: true },
  { type: 'grandparent', label: 'Grandparent', isImmediate: true },
  { type: 'grandchild', label: 'Grandchild', isImmediate: true },
  { type: 'aunt_uncle', label: 'Aunt / uncle', isImmediate: false },
  { type: 'niece_nephew', label: 'Niece / nephew', isImmediate: false },
  { type: 'cousin', label: 'Cousin', isImmediate: false },
  { type: 'in_law', label: 'In-law', isImmediate: false },
  { type: 'family_friend', label: 'Family friend', isImmediate: false },
  { type: 'chosen_family', label: 'Chosen family', isImmediate: false },
];

/**
 * Call the tag_family_relationship RPC. Returns the new immediate-state of the
 * target so the caller can update local UI without refetching everything.
 */
export async function tagRelationship(
  memberUserId: string,
  relationshipType: RelationshipType,
): Promise<{ circleId: string; isImmediate: boolean }> {
  const { data, error } = await supabase.rpc('tag_family_relationship', {
    _member_user_id: memberUserId,
    _relationship_type: relationshipType,
  });
  if (error) {
    throw new SupabaseFamilyError(
      error.message || 'Could not save that relationship.',
      error,
    );
  }
  // RPC returns a TABLE — Supabase wraps it in an array.
  const row = Array.isArray(data) ? data[0] : data;
  return {
    circleId: row?.circle_id as string,
    isImmediate: !!row?.is_immediate,
  };
}

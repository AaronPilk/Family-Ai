/**
 * Supabase data layer for the Vault proof-of-life flow.
 *
 * Two tables:
 *   - proof_vault_items: append-only entries. Server-stamped created_at; no
 *     edits, no deletes. Every entry is private to its author until a release
 *     exists pointing at a recipient.
 *   - vault_releases: one row per (author, recipient) scope. Granting access
 *     can be immediate, time-locked (unlock_at), or condition-locked
 *     (unlock_on_join + invite_token).
 *
 * RLS does the heavy lifting on reads — the client just asks for what it
 * wants and trusts the server. See migration 20260522000007_vault_releases.sql.
 */

import { supabase } from './supabase';

// ---- Types ------------------------------------------------------------------

export interface VaultEntry {
  id: string;
  authorUserId: string;
  body: string;
  mediaAssetId: string | null;
  createdAt: string; // ISO timestamp, server-stamped
}

export type ReleaseStatus =
  | 'immediate' // unlock_at null + !unlock_on_join → recipient already sees it
  | 'time-locked' // unlock_at in future → recipient sees it from that date
  | 'unlocked' // unlock_at in past → recipient now sees it
  | 'pending-join' // unlock_on_join + recipient_user_id null
  | 'revoked';

export interface VaultRelease {
  id: string;
  authorUserId: string;
  recipientUserId: string | null;
  recipientEmail: string | null;
  unlockAt: string | null;
  unlockOnJoin: boolean;
  inviteToken: string | null;
  releasedAt: string;
  revokedAt: string | null;
  status: ReleaseStatus;
}

export interface ReleasedVaultEntry extends VaultEntry {
  authorDisplayName: string;
}

export class SupabaseVaultError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SupabaseVaultError';
    this.cause = cause;
  }
}

// ---- Helpers ----------------------------------------------------------------

function deriveStatus(row: {
  unlock_at: string | null;
  unlock_on_join: boolean;
  recipient_user_id: string | null;
  revoked_at: string | null;
}): ReleaseStatus {
  if (row.revoked_at) return 'revoked';
  if (row.unlock_on_join && !row.recipient_user_id) return 'pending-join';
  if (!row.unlock_at) return 'immediate';
  const unlock = new Date(row.unlock_at).getTime();
  if (Number.isNaN(unlock) || unlock <= Date.now()) return 'unlocked';
  return 'time-locked';
}

interface ReleaseRow {
  id: string;
  author_user_id: string;
  recipient_user_id: string | null;
  recipient_email: string | null;
  unlock_at: string | null;
  unlock_on_join: boolean;
  invite_token: string | null;
  released_at: string;
  revoked_at: string | null;
}

function toRelease(row: ReleaseRow): VaultRelease {
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    recipientUserId: row.recipient_user_id,
    recipientEmail: row.recipient_email,
    unlockAt: row.unlock_at,
    unlockOnJoin: row.unlock_on_join,
    inviteToken: row.invite_token,
    releasedAt: row.released_at,
    revokedAt: row.revoked_at,
    status: deriveStatus(row),
  };
}

interface VaultItemRow {
  id: string;
  author_user_id: string;
  body: string;
  media_asset_id: string | null;
  created_at: string;
}

function toEntry(row: VaultItemRow): VaultEntry {
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    body: row.body,
    mediaAssetId: row.media_asset_id,
    createdAt: row.created_at,
  };
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) {
    throw new SupabaseVaultError('You must be signed in to use the vault.');
  }
  return uid;
}

// ---- Reads ------------------------------------------------------------------

/**
 * Every vault entry authored by the current user, most-recent first.
 */
export async function listMyVaultItems(): Promise<VaultEntry[]> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('proof_vault_items')
    .select('id, author_user_id, body, media_asset_id, created_at')
    .eq('author_user_id', uid)
    .order('created_at', { ascending: false });

  if (error) {
    throw new SupabaseVaultError('Could not load your vault.', error);
  }
  return (data ?? []).map((r) => toEntry(r as VaultItemRow));
}

/**
 * Every release the current user has CREATED (i.e. as the author). Used in
 * the author's vault home to show the "Releases" section.
 */
export async function listMyReleases(): Promise<VaultRelease[]> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('vault_releases')
    .select(
      'id, author_user_id, recipient_user_id, recipient_email, unlock_at, unlock_on_join, invite_token, released_at, revoked_at',
    )
    .eq('author_user_id', uid)
    .order('released_at', { ascending: false });

  if (error) {
    throw new SupabaseVaultError('Could not load your releases.', error);
  }
  return (data ?? []).map((r) => toRelease(r as ReleaseRow));
}

/**
 * Every release that targets the current user as the recipient. RLS already
 * gates this, so we don't filter by unlock condition — the recipient
 * surface decides whether to render or just say "unlocks on <date>".
 */
export async function listReleasesToMe(): Promise<VaultRelease[]> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('vault_releases')
    .select(
      'id, author_user_id, recipient_user_id, recipient_email, unlock_at, unlock_on_join, invite_token, released_at, revoked_at',
    )
    .eq('recipient_user_id', uid)
    .is('revoked_at', null)
    .order('released_at', { ascending: false });

  if (error) {
    throw new SupabaseVaultError('Could not load vaults released to you.', error);
  }
  return (data ?? []).map((r) => toRelease(r as ReleaseRow));
}

/**
 * All vault entries the current user is allowed to see as a recipient,
 * grouped by author. RLS enforces both:
 *   - the recipient has an unrevoked release pointing at this author
 *   - the release's unlock condition is met (immediate or past unlock_at,
 *     and not pending-join)
 *
 * Entries are returned ascending — oldest first — because the recipient
 * surface is a chronological wall (scroll down for newer).
 */
export async function listReleasedToMe(): Promise<{
  byAuthor: Array<{
    authorUserId: string;
    authorDisplayName: string;
    release: VaultRelease;
    entries: VaultEntry[];
  }>;
}> {
  const releases = await listReleasesToMe();
  // Filter out releases that haven't unlocked yet for display purposes.
  const visible = releases.filter(
    (r) => r.status === 'immediate' || r.status === 'unlocked',
  );

  if (visible.length === 0) {
    return { byAuthor: [] };
  }

  const authorIds = Array.from(new Set(visible.map((r) => r.authorUserId)));

  // Fetch entries for all visible authors in one shot.
  const { data: itemRows, error: itemErr } = await supabase
    .from('proof_vault_items')
    .select('id, author_user_id, body, media_asset_id, created_at')
    .in('author_user_id', authorIds)
    .order('created_at', { ascending: true });

  if (itemErr) {
    throw new SupabaseVaultError('Could not load released entries.', itemErr);
  }

  // Display names.
  const { data: profileRows, error: profileErr } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', authorIds);

  if (profileErr) {
    // Not fatal — fall back to "Family member".
    // eslint-disable-next-line no-console
    console.warn('[supabaseVault] profiles lookup failed:', profileErr.message);
  }

  const nameMap = new Map<string, string>();
  for (const p of profileRows ?? []) {
    nameMap.set(p.user_id as string, (p.display_name as string) || 'Family member');
  }

  const itemsByAuthor = new Map<string, VaultEntry[]>();
  for (const r of (itemRows ?? []) as VaultItemRow[]) {
    const list = itemsByAuthor.get(r.author_user_id) ?? [];
    list.push(toEntry(r));
    itemsByAuthor.set(r.author_user_id, list);
  }

  return {
    byAuthor: visible.map((release) => ({
      authorUserId: release.authorUserId,
      authorDisplayName: nameMap.get(release.authorUserId) ?? 'A family member',
      release,
      entries: itemsByAuthor.get(release.authorUserId) ?? [],
    })),
  };
}

/**
 * Fetch one vault entry (must be authored by the current user, or RLS will
 * 403). Used by the detail screen.
 */
export async function getVaultItem(id: string): Promise<VaultEntry | null> {
  const { data, error } = await supabase
    .from('proof_vault_items')
    .select('id, author_user_id, body, media_asset_id, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new SupabaseVaultError('Could not load this entry.', error);
  }
  return data ? toEntry(data as VaultItemRow) : null;
}

// ---- Writes -----------------------------------------------------------------

export interface AddVaultItemInput {
  body: string;
  mediaAssetId?: string;
}

/**
 * Append a new entry. The server stamps created_at. The trigger blocks any
 * subsequent UPDATE or DELETE, so once this returns the entry is forensic.
 */
export async function addVaultItem(input: AddVaultItemInput): Promise<VaultEntry> {
  const uid = await currentUserId();
  const body = input.body.trim();
  if (body.length === 0) {
    throw new SupabaseVaultError('Write something before saving.');
  }
  if (body.length > 10000) {
    throw new SupabaseVaultError('That entry is too long. Try splitting it across a few days.');
  }

  const { data, error } = await supabase
    .from('proof_vault_items')
    .insert({
      author_user_id: uid,
      body,
      media_asset_id: input.mediaAssetId ?? null,
    })
    .select('id, author_user_id, body, media_asset_id, created_at')
    .single();

  if (error || !data) {
    throw new SupabaseVaultError('Could not save your entry.', error);
  }
  return toEntry(data as VaultItemRow);
}

export interface CreateReleaseInput {
  recipientUserId?: string;
  recipientEmail?: string;
  /** ISO timestamp. If set + in future, the release is time-locked. */
  unlockAt?: string;
  /** If true, recipient must join FamLink (via an invite link) before they can see anything. */
  unlockOnJoin?: boolean;
  /** Optional invite token to associate with a condition-locked release. */
  inviteToken?: string;
}

/**
 * Create a release. The caller picks ONE recipient (user id OR email) and ONE
 * unlock condition (immediate, time-locked, or join-locked).
 */
export async function createRelease(input: CreateReleaseInput): Promise<VaultRelease> {
  const uid = await currentUserId();

  if (!input.recipientUserId && !input.recipientEmail) {
    throw new SupabaseVaultError('Pick a recipient before releasing.');
  }
  if (input.unlockOnJoin && input.recipientUserId) {
    throw new SupabaseVaultError(
      'Join-locked releases are for people who haven\'t joined yet — pick "release now" or "release on a date" for an existing family member.',
    );
  }

  const insertRow: {
    author_user_id: string;
    recipient_user_id: string | null;
    recipient_email: string | null;
    unlock_at: string | null;
    unlock_on_join: boolean;
    invite_token: string | null;
  } = {
    author_user_id: uid,
    recipient_user_id: input.recipientUserId ?? null,
    recipient_email: input.recipientEmail?.trim().toLowerCase() ?? null,
    unlock_at: input.unlockAt ?? null,
    unlock_on_join: !!input.unlockOnJoin,
    invite_token: input.inviteToken ?? null,
  };

  const { data, error } = await supabase
    .from('vault_releases')
    .insert(insertRow)
    .select(
      'id, author_user_id, recipient_user_id, recipient_email, unlock_at, unlock_on_join, invite_token, released_at, revoked_at',
    )
    .single();

  if (error || !data) {
    // Friendly unique-constraint message.
    if (error?.code === '23505') {
      throw new SupabaseVaultError(
        'You already have an active release to this person. Revoke it first if you want to change the conditions.',
        error,
      );
    }
    throw new SupabaseVaultError('Could not create the release.', error);
  }
  return toRelease(data as ReleaseRow);
}

/**
 * Revoke a release. The author keeps their entries; the recipient simply
 * loses access. Not a hard delete — `revoked_at` is stamped so we keep an
 * audit trail.
 */
export async function revokeRelease(releaseId: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await supabase
    .from('vault_releases')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', releaseId)
    .eq('author_user_id', uid)
    .is('revoked_at', null);

  if (error) {
    throw new SupabaseVaultError('Could not revoke the release.', error);
  }
}

// ---- Formatting helpers (used by screens) -----------------------------------

export interface FamilyMemberOption {
  userId: string;
  displayName: string;
}

/**
 * List every OTHER active member of the current user's primary family circle,
 * used to populate the recipient picker on the release screen.
 *
 * Returns [] if the user isn't in a circle, or if they're the only member.
 */
export async function listFamilyMembersForRelease(): Promise<FamilyMemberOption[]> {
  const uid = await currentUserId();

  // Primary circle = earliest active membership.
  const { data: memRows, error: memErr } = await supabase
    .from('family_memberships')
    .select('circle_id, joined_at')
    .eq('user_id', uid)
    .is('removed_at', null)
    .order('joined_at', { ascending: true })
    .limit(1);

  if (memErr) {
    throw new SupabaseVaultError('Could not find your family circle.', memErr);
  }
  const circleId = memRows?.[0]?.circle_id as string | undefined;
  if (!circleId) return [];

  const { data: others, error: othersErr } = await supabase
    .from('family_memberships')
    .select('user_id')
    .eq('circle_id', circleId)
    .neq('user_id', uid)
    .is('removed_at', null);

  if (othersErr) {
    throw new SupabaseVaultError('Could not list family members.', othersErr);
  }
  const otherIds = (others ?? []).map((r) => r.user_id as string);
  if (otherIds.length === 0) return [];

  const { data: profileRows, error: profileErr } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', otherIds);

  if (profileErr) {
    // Soft-fail: still return ids with generic display names so the UI works.
    // eslint-disable-next-line no-console
    console.warn('[supabaseVault] profiles fetch failed:', profileErr.message);
    return otherIds.map((id) => ({ userId: id, displayName: 'Family member' }));
  }

  const names = new Map<string, string>();
  for (const p of profileRows ?? []) {
    names.set(p.user_id as string, (p.display_name as string) || 'Family member');
  }
  return otherIds.map((id) => ({
    userId: id,
    displayName: names.get(id) ?? 'Family member',
  }));
}

export function formatReleaseStatus(status: ReleaseStatus): string {
  switch (status) {
    case 'immediate':
      return 'Live now';
    case 'time-locked':
      return 'Unlocks later';
    case 'unlocked':
      return 'Unlocked';
    case 'pending-join':
      return 'Waiting for them to join';
    case 'revoked':
      return 'Revoked';
  }
}

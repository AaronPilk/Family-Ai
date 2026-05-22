/**
 * Supabase data layer for Letters — asymmetric private messages.
 *
 * The sender and recipient see *different shapes* of the same letter:
 *   - Recipient queries the `letters` table directly. They get read_at,
 *     read_visible_to_sender (their own choice), and decided_at — they
 *     have a right to know all of it.
 *   - Sender queries the `letters_for_sender` view, never the base table
 *     for outgoing reads. The view hard-redacts read_at unless the
 *     recipient opted to make it visible. We avoid exposing the
 *     recipient's choice itself even via this client; only a coarse
 *     `recipient_has_decided` boolean is surfaced.
 *
 * All writes flow through here. The "decide" call must include decided_at
 * because the table's immutability trigger requires the pair to be set
 * together; the trigger also makes the choice permanent at the DB level.
 */

import { supabase } from './supabase';

// ---- Types ------------------------------------------------------------------

/** What the recipient sees about an incoming letter — the full truth. */
export interface Letter {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  /**
   * Recipient's choice. null = undecided. false = sender will only ever see
   * Delivered. true = sender will see the read timestamp.
   */
  readVisibleToSender: boolean | null;
  decidedAt: string | null;
}

/** What the sender sees about their own outgoing letter — read_at redacted. */
export interface LetterForSender {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  body: string;
  sentAt: string;
  /**
   * Non-null iff the recipient read the letter AND chose to let the sender
   * know. Otherwise always null — even if the letter was actually read.
   */
  visibleReadAt: string | null;
  /**
   * True iff the recipient has made a permanent choice. The sender does NOT
   * learn what that choice was — only that one was made. We use this to show
   * a softer "they haven't decided whether to let you know" footnote.
   */
  recipientHasDecided: boolean;
}

export class SupabaseLettersError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SupabaseLettersError';
    this.cause = cause;
  }
}

// ---- Profile name cache (shared shape with supabaseEvents) ------------------
// Letters surfaces show a lot of "Mom", "Dad" labels. Cache to avoid one
// profile fetch per row.

const profileNameCache = new Map<string, string>();

async function prefetchProfileNames(userIds: string[]): Promise<void> {
  const missing = userIds.filter((id) => id && !profileNameCache.has(id));
  if (missing.length === 0) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', missing);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseLetters] profile name fetch failed:', error.message);
    return;
  }
  for (const row of data ?? []) {
    profileNameCache.set(row.user_id as string, (row.display_name as string) || 'Family member');
  }
}

export function getCachedDisplayNameForUser(userId: string): string | undefined {
  return profileNameCache.get(userId);
}

/** Exposed for screens that want to await name hydration before rendering. */
export async function hydrateDisplayNamesForLetters(
  letters: ReadonlyArray<{ senderUserId?: string; recipientUserId?: string }>,
): Promise<void> {
  const uids = new Set<string>();
  for (const l of letters) {
    if (l.senderUserId) uids.add(l.senderUserId);
    if (l.recipientUserId) uids.add(l.recipientUserId);
  }
  await prefetchProfileNames(Array.from(uids));
}

// ---- Family-circle member lookup (for the compose recipient picker) --------

export interface LetterRecipientCandidate {
  userId: string;
  displayName: string;
}

/**
 * Returns every other member of the current user's family circles, deduped.
 * The compose screen feeds this to a dropdown. We exclude the current user
 * because the DB constraint already blocks self-send — no point showing them.
 */
export async function listLetterRecipientCandidates(): Promise<LetterRecipientCandidate[]> {
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) return [];

  // Which circles am I in?
  const { data: mine, error: mineErr } = await supabase
    .from('family_memberships')
    .select('circle_id')
    .eq('user_id', myUuid)
    .is('removed_at', null);
  if (mineErr) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseLetters] my circles fetch failed:', mineErr.message);
    return [];
  }
  const circleIds = (mine ?? []).map((r) => r.circle_id as string);
  if (circleIds.length === 0) return [];

  // Everyone else in those circles.
  const { data: others, error: othersErr } = await supabase
    .from('family_memberships')
    .select('user_id')
    .in('circle_id', circleIds)
    .is('removed_at', null);
  if (othersErr) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseLetters] circle members fetch failed:', othersErr.message);
    return [];
  }
  const otherIds = Array.from(
    new Set((others ?? []).map((r) => r.user_id as string).filter((id) => id !== myUuid)),
  );
  if (otherIds.length === 0) return [];

  await prefetchProfileNames(otherIds);
  return otherIds
    .map((id) => ({
      userId: id,
      displayName: profileNameCache.get(id) || 'Family member',
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

// ---- Send ------------------------------------------------------------------

export interface SendLetterInput {
  recipient_user_id: string;
  body: string;
}

export async function sendLetter(input: SendLetterInput): Promise<Letter> {
  const body = input.body.trim();
  if (!body) throw new SupabaseLettersError('A letter needs a body.');
  if (body.length > 8000) {
    throw new SupabaseLettersError('Letters are capped at 8,000 characters.');
  }

  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) throw new SupabaseLettersError('Not signed in.');
  if (input.recipient_user_id === myUuid) {
    throw new SupabaseLettersError('You can’t send a letter to yourself.');
  }

  const { data, error } = await supabase
    .from('letters')
    .insert({
      sender_user_id: myUuid,
      recipient_user_id: input.recipient_user_id,
      body,
    })
    .select('*')
    .single();
  if (error || !data) {
    throw new SupabaseLettersError(error?.message || 'Failed to send letter.', error);
  }

  // Best-effort notification row. Letters spec says: use the existing
  // notifications table; if it doesn't exist, create the row directly. It
  // exists in this codebase, so we just insert. RLS on notifications might
  // refuse a client-side insert (it's owned by the recipient) — that's fine,
  // we swallow the error rather than failing the send. The letter has already
  // been delivered at the DB level.
  try {
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: input.recipient_user_id,
      kind: 'letter_received',
      payload: {
        letter_id: data.id,
        sender_user_id: myUuid,
        sent_at: data.sent_at,
        preview: body.slice(0, 80),
      },
    });
    if (notifErr) {
      // eslint-disable-next-line no-console
      console.warn('[supabaseLetters] notification insert failed (non-fatal):', notifErr.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseLetters] notification insert threw (non-fatal):', err);
  }

  return rowToLetter(data);
}

// ---- Read (recipient) ------------------------------------------------------

/**
 * Letters sent TO me. Latest first.
 */
export async function listLettersToMe(): Promise<Letter[]> {
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) return [];

  const { data, error } = await supabase
    .from('letters')
    .select('*')
    .eq('recipient_user_id', myUuid)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
    .limit(500);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseLetters] listLettersToMe failed:', error.message);
    return [];
  }
  const letters = (data ?? []).map(rowToLetter);
  await hydrateDisplayNamesForLetters(letters);
  return letters;
}

export async function getLetterToMe(letterId: string): Promise<Letter | null> {
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) return null;

  const { data, error } = await supabase
    .from('letters')
    .select('*')
    .eq('id', letterId)
    .eq('recipient_user_id', myUuid)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) return null;
  const letter = rowToLetter(data);
  await hydrateDisplayNamesForLetters([letter]);
  return letter;
}

// ---- Read (sender) ---------------------------------------------------------

/**
 * Letters sent FROM me. Uses the sender-safe view so read_at is never exposed
 * unless the recipient explicitly opted in.
 */
export async function listLettersFromMe(): Promise<LetterForSender[]> {
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) return [];

  const { data, error } = await supabase
    .from('letters_for_sender')
    .select('*')
    .eq('sender_user_id', myUuid)
    .order('sent_at', { ascending: false })
    .limit(500);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseLetters] listLettersFromMe failed:', error.message);
    return [];
  }
  const letters = (data ?? []).map(rowToLetterForSender);
  await hydrateDisplayNamesForLetters(letters);
  return letters;
}

export async function getLetterFromMe(letterId: string): Promise<LetterForSender | null> {
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) return null;

  const { data, error } = await supabase
    .from('letters_for_sender')
    .select('*')
    .eq('id', letterId)
    .eq('sender_user_id', myUuid)
    .maybeSingle();
  if (error || !data) return null;
  const letter = rowToLetterForSender(data);
  await hydrateDisplayNamesForLetters([letter]);
  return letter;
}

// ---- Recipient writes ------------------------------------------------------

/**
 * Idempotently set read_at on an incoming letter. We DO NOT touch
 * read_visible_to_sender here — that's a separate, deliberate decision.
 *
 * If read_at is already set, we no-op (the DB trigger would also refuse).
 */
export async function markLetterRead(letterId: string): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) throw new SupabaseLettersError('Not signed in.');

  // Check current state first to avoid pinging the trigger.
  const { data: row, error: readErr } = await supabase
    .from('letters')
    .select('id, read_at')
    .eq('id', letterId)
    .eq('recipient_user_id', myUuid)
    .maybeSingle();
  if (readErr || !row) return;
  if (row.read_at) return;

  const { error } = await supabase
    .from('letters')
    .update({ read_at: new Date().toISOString() })
    .eq('id', letterId)
    .eq('recipient_user_id', myUuid)
    .is('read_at', null); // belt-and-braces against double-write races
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseLetters] markLetterRead failed:', error.message);
  }
}

/**
 * The decision call. Sets read_visible_to_sender + decided_at together
 * (the DB trigger requires both). Choice is permanent — a second call with
 * a different value will be rejected by Postgres.
 */
export async function decideLetterVisibility(
  letterId: string,
  visible: boolean,
): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) throw new SupabaseLettersError('Not signed in.');

  const { error } = await supabase
    .from('letters')
    .update({
      read_visible_to_sender: visible,
      decided_at: new Date().toISOString(),
    })
    .eq('id', letterId)
    .eq('recipient_user_id', myUuid);
  if (error) {
    throw new SupabaseLettersError(error.message, error);
  }
}

// ---- Realtime --------------------------------------------------------------

/**
 * Subscribe to UPDATEs on the sender's own letters. The point of this is
 * Delivered → Read flips: when the recipient chooses "yes, let them know",
 * the sender's UI should re-render with the read timestamp.
 *
 * We listen on UPDATE so we catch read_at being set, decided_at being set,
 * and read_visible_to_sender flipping. The callback should re-fetch via
 * listLettersFromMe / getLetterFromMe rather than trusting raw payload —
 * payload comes from the base table and could contain read_at even when
 * the user chose "no". The view layer is the only safe read path.
 */
export function subscribeToMyLetterChanges(
  callback: () => void,
): () => void {
  let mySenderUuid: string | null = null;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  // Async bootstrap; subscription is wired up once we know who I am.
  (async () => {
    const { data: session } = await supabase.auth.getUser();
    mySenderUuid = session.user?.id ?? null;
    if (!mySenderUuid) return;
    channel = supabase
      .channel(`letters-mine-${mySenderUuid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'letters',
          filter: `sender_user_id=eq.${mySenderUuid}`,
        },
        () => {
          // Re-fetch via the sender-safe view. Never trust the raw payload —
          // it can contain read_at even when the recipient chose to hide it.
          callback();
        },
      )
      .subscribe();
  })().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[supabaseLetters] subscribe bootstrap failed:', err);
  });

  return () => {
    if (channel) {
      void supabase.removeChannel(channel);
    }
  };
}

// ---- Row mappers -----------------------------------------------------------

function rowToLetter(row: Record<string, unknown>): Letter {
  return {
    id: row.id as string,
    senderUserId: row.sender_user_id as string,
    recipientUserId: row.recipient_user_id as string,
    body: row.body as string,
    sentAt: row.sent_at as string,
    readAt: (row.read_at as string | null) ?? null,
    readVisibleToSender: (row.read_visible_to_sender as boolean | null) ?? null,
    decidedAt: (row.decided_at as string | null) ?? null,
  };
}

function rowToLetterForSender(row: Record<string, unknown>): LetterForSender {
  return {
    id: row.id as string,
    senderUserId: row.sender_user_id as string,
    recipientUserId: row.recipient_user_id as string,
    body: row.body as string,
    sentAt: row.sent_at as string,
    visibleReadAt: (row.visible_read_at as string | null) ?? null,
    recipientHasDecided: Boolean(row.recipient_has_decided),
  };
}

// ---- Formatting helpers (exported so screens stay consistent) --------------

/**
 * "2h ago", "3d ago", "Mar 14" — used in row metadata and the sender's
 * "Read 2h ago" pill.
 */
export function whenAgoFromIso(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const now = new Date();
  const sec = Math.max(1, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Build the small status pill the sender sees on each outgoing letter.
 * Critically, this NEVER returns a read time unless visibleReadAt is set.
 */
export function senderStatusLabel(letter: LetterForSender): string {
  if (letter.visibleReadAt) return `Read ${whenAgoFromIso(letter.visibleReadAt)}`;
  return 'Delivered';
}

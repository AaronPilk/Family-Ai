/**
 * Supabase data layer for events + event chat.
 *
 * Translates between the DB schema (UUIDs, user_ids) and the existing
 * FamilyEvent / MomentMessage shapes the screens already speak. The mapping
 * for "who is this user?" goes UUID → `user_<first8>` synthetic AnyMemberId.
 * Display names come from the `profiles` table via a per-fetch cache.
 *
 * All writes go through here, never directly from screens. That keeps RLS
 * failures, optimistic updates, and Realtime fan-out in one place.
 */

import { supabase } from './supabase';
import {
  type FamilyEvent,
  type EventGuest,
  type EventKind,
  type EventRsvp,
  type MomentMessage,
  type MomentStatus,
  type SupabaseUserMemberId,
  type AnyMemberId,
} from './mockData';

// ---- Helpers ----------------------------------------------------------------

/**
 * Turn a Supabase user uuid into the synthetic MemberId screens use. Keeping
 * this stable across calls means message bubbles and avatars don't flicker.
 */
export function userIdToMemberId(uuid: string): SupabaseUserMemberId {
  const head = uuid.replace(/-/g, '').slice(0, 8);
  return `user_${head}` as SupabaseUserMemberId;
}

/**
 * Cache of synthetic id → { name, uuid } so screens can render names without
 * each row firing its own profile fetch. Populated on every fetch* call.
 */
const profileCache = new Map<SupabaseUserMemberId, { uuid: string; displayName: string }>();

export function getCachedDisplayName(id: SupabaseUserMemberId): string | undefined {
  return profileCache.get(id)?.displayName;
}

export function getAllCachedProfiles(): Map<SupabaseUserMemberId, { uuid: string; displayName: string }> {
  return new Map(profileCache);
}

function rememberProfile(uuid: string, displayName: string): SupabaseUserMemberId {
  const id = userIdToMemberId(uuid);
  profileCache.set(id, { uuid, displayName });
  return id;
}

function statusFromDates(starts: string | null, ends: string | null): MomentStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!starts) return 'planning';
  const s = new Date(starts + 'T00:00:00');
  const e = ends ? new Date(ends + 'T23:59:59') : s;
  if (today < s) return 'upcoming';
  if (today <= e) return 'happening';
  return 'past';
}

function rsvpFromDb(raw: string | null | undefined): EventRsvp {
  if (raw === 'going' || raw === 'maybe' || raw === 'no' || raw === 'invited') return raw;
  return 'invited';
}

function dateRangeText(starts?: string | null, ends?: string | null): string {
  if (!starts) return 'Date TBD';
  const s = new Date(starts + 'T00:00:00');
  const e = ends ? new Date(ends + 'T00:00:00') : null;
  const sFmt = s.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (!e || ends === starts) return sFmt;
  const sameYear = s.getFullYear() === e.getFullYear();
  const eFmt = sameYear
    ? e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${sFmt} – ${eFmt}`;
}

function whenAgo(iso: string): string {
  const then = new Date(iso);
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

const COVER_TINTS: Record<EventKind, string> = {
  reunion: '#E8B274',
  vacation: '#9BC7E4',
  holiday: '#C0345C',
  gathering: '#9BC97A',
  other: '#C09155',
};
const COVER_GLYPHS: Record<EventKind, string> = {
  reunion: '🌾',
  vacation: '🏖',
  holiday: '🎄',
  gathering: '🎉',
  other: '✨',
};

// ---- Profile prefetch -------------------------------------------------------

async function prefetchProfiles(userIds: string[]): Promise<void> {
  const missing = userIds.filter((uid) => !profileCache.has(userIdToMemberId(uid)));
  if (missing.length === 0) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', missing);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseEvents] profiles fetch failed:', error.message);
    return;
  }
  for (const row of data ?? []) {
    rememberProfile(row.user_id as string, (row.display_name as string) || 'Family member');
  }
}

// ---- Read -------------------------------------------------------------------

/**
 * Returns every event the current user can see — RLS handles the gating.
 * For UI purposes we fetch events the user hosts plus events they're a guest
 * of, dedupe, and translate.
 */
export async function fetchMyEvents(): Promise<FamilyEvent[]> {
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) return [];

  // Events I host
  const { data: hosted, error: hostedErr } = await supabase
    .from('events')
    .select('*')
    .eq('host_user_id', myUuid)
    .is('deleted_at', null);
  if (hostedErr) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseEvents] hosted events fetch failed:', hostedErr.message);
  }

  // Events I'm a guest of
  const { data: guestRows, error: guestErr } = await supabase
    .from('event_guests')
    .select('event_id')
    .eq('user_id', myUuid);
  if (guestErr) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseEvents] guest event ids fetch failed:', guestErr.message);
  }

  const guestEventIds = (guestRows ?? []).map((r) => r.event_id as string);
  let guested: typeof hosted = [];
  if (guestEventIds.length > 0) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .in('id', guestEventIds)
      .is('deleted_at', null);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[supabaseEvents] guested events fetch failed:', error.message);
    } else {
      guested = data ?? [];
    }
  }

  const byId = new Map<string, NonNullable<typeof hosted>[number]>();
  for (const e of hosted ?? []) byId.set(e.id as string, e);
  for (const e of guested ?? []) byId.set(e.id as string, e);
  const all = Array.from(byId.values());
  if (all.length === 0) return [];

  // Fetch guests for all events in one go.
  const eventIds = all.map((e) => e.id as string);
  const { data: guestsAll } = await supabase
    .from('event_guests')
    .select('*')
    .in('event_id', eventIds);

  const userIdsToHydrate = new Set<string>();
  for (const e of all) userIdsToHydrate.add(e.host_user_id as string);
  for (const g of guestsAll ?? []) {
    const uid = g.user_id as string | null;
    if (uid) userIdsToHydrate.add(uid);
  }
  await prefetchProfiles(Array.from(userIdsToHydrate));

  const events: FamilyEvent[] = [];
  for (const row of all) {
    const guests: EventGuest[] = (guestsAll ?? [])
      .filter((g) => g.event_id === row.id)
      .map((g) => {
        const memberId: AnyMemberId = g.user_id
          ? userIdToMemberId(g.user_id as string)
          : (`invite_${g.id as string}` as SupabaseUserMemberId);
        return {
          memberId,
          rsvp: rsvpFromDb(g.rsvp as string),
          isHost: Boolean(g.is_host),
          pendingInvite: g.user_id == null,
          displayName: (g.display_name as string) || undefined,
        };
      });

    // Ensure the host appears as a guest entry too (some hosts won't have a
    // matching event_guests row). Useful so the UI's "you" pill works.
    const hostId = row.host_user_id as string;
    const hostMemberId = userIdToMemberId(hostId);
    if (!guests.some((g) => g.memberId === hostMemberId)) {
      const hostProfile = profileCache.get(hostMemberId);
      guests.unshift({
        memberId: hostMemberId,
        rsvp: 'going',
        isHost: true,
        displayName: hostProfile?.displayName,
      });
    }

    const kind = (row.kind as EventKind) ?? 'gathering';
    events.push({
      id: row.id as string,
      branchIds: [],
      kind,
      title: (row.title as string) || 'Untitled event',
      subtitle: (row.subtitle as string) || '',
      dateRangeText: dateRangeText(row.starts_at as string | null, row.ends_at as string | null),
      startsAt:
        (row.starts_at as string | null) ?? new Date().toISOString().slice(0, 10),
      endsAt: (row.ends_at as string | null) ?? (row.starts_at as string | null) ?? new Date().toISOString().slice(0, 10),
      status:
        ((row.status as MomentStatus | null) ?? statusFromDates(row.starts_at as string | null, row.ends_at as string | null)),
      coverTint: (row.cover_tint as string) || COVER_TINTS[kind],
      coverGlyph: (row.cover_glyph as string) || COVER_GLYPHS[kind],
      locationText: (row.location_text as string) || undefined,
      organizerId: hostMemberId,
      guests,
      bringList: [],
      polls: {},
      activity: [],
      photos: [],
    });
  }

  // Newest start date first for the upcoming bucket; legacy sort happens at
  // the screen level too.
  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return events;
}

export async function fetchEvent(eventId: string): Promise<FamilyEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) return null;

  const { data: guests } = await supabase
    .from('event_guests')
    .select('*')
    .eq('event_id', eventId);

  const uids = new Set<string>([data.host_user_id as string]);
  for (const g of guests ?? []) {
    if (g.user_id) uids.add(g.user_id as string);
  }
  await prefetchProfiles(Array.from(uids));

  const kind = (data.kind as EventKind) ?? 'gathering';
  const mappedGuests: EventGuest[] = (guests ?? []).map((g) => {
    const memberId: AnyMemberId = g.user_id
      ? userIdToMemberId(g.user_id as string)
      : (`invite_${g.id as string}` as SupabaseUserMemberId);
    return {
      memberId,
      rsvp: rsvpFromDb(g.rsvp as string),
      isHost: Boolean(g.is_host),
      pendingInvite: g.user_id == null,
      displayName: (g.display_name as string) || undefined,
    };
  });
  const hostMemberId = userIdToMemberId(data.host_user_id as string);
  if (!mappedGuests.some((g) => g.memberId === hostMemberId)) {
    mappedGuests.unshift({
      memberId: hostMemberId,
      rsvp: 'going',
      isHost: true,
      displayName: profileCache.get(hostMemberId)?.displayName,
    });
  }

  return {
    id: data.id as string,
    branchIds: [],
    kind,
    title: (data.title as string) || 'Untitled event',
    subtitle: (data.subtitle as string) || '',
    dateRangeText: dateRangeText(data.starts_at as string | null, data.ends_at as string | null),
    startsAt: (data.starts_at as string | null) ?? new Date().toISOString().slice(0, 10),
    endsAt: (data.ends_at as string | null) ?? (data.starts_at as string | null) ?? new Date().toISOString().slice(0, 10),
    status:
      ((data.status as MomentStatus | null) ?? statusFromDates(data.starts_at as string | null, data.ends_at as string | null)),
    coverTint: (data.cover_tint as string) || COVER_TINTS[kind],
    coverGlyph: (data.cover_glyph as string) || COVER_GLYPHS[kind],
    locationText: (data.location_text as string) || undefined,
    organizerId: hostMemberId,
    guests: mappedGuests,
    bringList: [],
    polls: {},
    activity: [],
    photos: [],
  };
}

export async function fetchEventMessages(eventId: string): Promise<MomentMessage[]> {
  const { data, error } = await supabase
    .from('event_messages')
    .select('*')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error || !data) return [];

  const uids = Array.from(new Set(data.map((r) => r.author_user_id as string)));
  await prefetchProfiles(uids);

  return data.map((r) => ({
    id: r.id as string,
    authorId: userIdToMemberId(r.author_user_id as string),
    body: r.body as string,
    whenAgo: whenAgo(r.created_at as string),
    at: r.created_at as string,
  }));
}

// ---- Realtime ---------------------------------------------------------------

export function subscribeToEventMessages(
  eventId: string,
  onInsert: (msg: MomentMessage) => void,
): () => void {
  const channel = supabase
    .channel(`event-messages-${eventId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'event_messages',
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        const row = payload.new as {
          id?: string;
          event_id?: string;
          author_user_id?: string;
          body?: string;
          created_at?: string;
        };
        // Defensive: postgres_changes occasionally delivers cross-channel
        // messages during reconnect. The server filter SHOULD have already
        // gated this, but re-check on the client because mis-routed events
        // would otherwise leak into another event's chat. Also drop any
        // partial payload that doesn't have the fields we need.
        if (
          !row ||
          row.event_id !== eventId ||
          !row.id ||
          !row.author_user_id ||
          typeof row.body !== 'string' ||
          !row.created_at
        ) {
          return;
        }
        const msg: MomentMessage = {
          id: row.id,
          authorId: userIdToMemberId(row.author_user_id),
          body: row.body,
          whenAgo: whenAgo(row.created_at),
          at: row.created_at,
        };
        // Emit synchronously so message order matches insert order on the
        // server side. Hydrate the author's display name in the background;
        // getCachedDisplayName() will fall back to "Family member" until the
        // prefetch resolves, then re-renders will pick up the real name.
        onInsert(msg);
        if (!profileCache.has(userIdToMemberId(row.author_user_id))) {
          void prefetchProfiles([row.author_user_id]).catch(() => {
            /* surfaced via console.warn inside prefetchProfiles */
          });
        }
      },
    )
    .subscribe();
  return () => {
    // removeChannel returns a promise; let it run in the background. We don't
    // need to await — the supabase client cleans up the websocket internally.
    void supabase.removeChannel(channel);
  };
}

// ---- Write ------------------------------------------------------------------

export interface CreateEventInput {
  title: string;
  kind: EventKind;
  startsAt?: string;
  endsAt?: string;
  locationText?: string;
  subtitle?: string;
  coverTint?: string;
  coverGlyph?: string;
  inviteEmails?: string[];
}

async function getMyPrimaryCircle(myUuid: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('family_memberships')
    .select('circle_id, joined_at')
    .eq('user_id', myUuid)
    .order('joined_at', { ascending: true })
    .limit(1);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseEvents] primary circle lookup failed:', error.message);
    return null;
  }
  return (data?.[0]?.circle_id as string | undefined) ?? null;
}

export async function createEvent(input: CreateEventInput): Promise<{ eventId: string }> {
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) throw new Error('Not signed in.');
  const circleId = await getMyPrimaryCircle(myUuid);
  if (!circleId) {
    throw new Error(
      'No family circle found for your account. Try signing out and back in to re-trigger account setup.',
    );
  }

  const kind = input.kind ?? 'gathering';
  const insertRow = {
    host_user_id: myUuid,
    primary_circle_id: circleId,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || null,
    kind,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || input.startsAt || null,
    location_text: input.locationText?.trim() || null,
    cover_tint: input.coverTint || COVER_TINTS[kind],
    cover_glyph: input.coverGlyph || COVER_GLYPHS[kind],
    status: 'planning' as const,
  };

  const { data, error } = await supabase
    .from('events')
    .insert(insertRow)
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(error?.message || 'Failed to create event.');
  }
  const eventId = data.id as string;

  // Link the event to the host's primary circle.
  const { error: circleErr } = await supabase
    .from('event_circles')
    .insert({ event_id: eventId, circle_id: circleId });
  if (circleErr) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseEvents] event_circles insert failed:', circleErr.message);
  }

  // Insert the host themselves as a guest so they show up in lists.
  const { error: selfErr } = await supabase.from('event_guests').insert({
    event_id: eventId,
    user_id: myUuid,
    display_name: profileCache.get(userIdToMemberId(myUuid))?.displayName || 'You',
    rsvp: 'going',
    is_host: true,
    invited_by_user_id: myUuid,
  });
  if (selfErr) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseEvents] host self-guest insert failed:', selfErr.message);
  }

  // Insert email invites. The screen already pre-validates with a stricter
  // regex; this second pass is a defensive belt-and-braces filter against
  // callers that bypass the UI parser.
  const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  const emails = (input.inviteEmails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e));
  if (emails.length > 0) {
    const rows = emails.map((email) => ({
      event_id: eventId,
      user_id: null,
      invited_email: email,
      display_name: email.split('@')[0] || email,
      rsvp: 'invited' as const,
      invited_by_user_id: myUuid,
    }));
    const { error: inviteErr } = await supabase.from('event_guests').insert(rows);
    if (inviteErr) {
      // eslint-disable-next-line no-console
      console.warn('[supabaseEvents] invite insert failed:', inviteErr.message);
    }
  }

  return { eventId };
}

export async function setMyRsvp(eventId: string, rsvp: 'going' | 'maybe' | 'no'): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) throw new Error('Not signed in.');

  // Try update first; if no row exists, insert one.
  const { data, error } = await supabase
    .from('event_guests')
    .update({ rsvp })
    .eq('event_id', eventId)
    .eq('user_id', myUuid)
    .select('id');
  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    const displayName =
      profileCache.get(userIdToMemberId(myUuid))?.displayName || 'You';
    const { error: insertErr } = await supabase.from('event_guests').insert({
      event_id: eventId,
      user_id: myUuid,
      display_name: displayName,
      rsvp,
    });
    if (insertErr) throw new Error(insertErr.message);
  }
}

export async function addEventMessage(eventId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) throw new Error('Not signed in.');

  const { error } = await supabase.from('event_messages').insert({
    event_id: eventId,
    author_user_id: myUuid,
    body: trimmed.slice(0, 4000),
  });
  if (error) throw new Error(error.message);
}

// ---- Event media ------------------------------------------------------------

export interface EventMediaRow {
  id: string;
  eventId: string;
  mediaAssetId: string;
  storagePath: string;
  mimeType: string | null;
  kind: 'image' | 'video' | 'audio' | 'document' | 'screenshot';
  width: number | null;
  height: number | null;
  caption: string | null;
  postedByUserId: string;
  postedAt: string;
}

export async function fetchEventMedia(eventId: string): Promise<EventMediaRow[]> {
  const { data, error } = await supabase
    .from('event_media')
    .select(
      `
      id,
      event_id,
      media_asset_id,
      caption,
      posted_by_user_id,
      posted_at,
      media:media_asset_id (
        storage_path,
        mime_type,
        kind,
        width,
        height
      )
    `,
    )
    .eq('event_id', eventId)
    .order('posted_at', { ascending: false })
    .limit(200);

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseEvents] fetchEventMedia failed:', error?.message);
    return [];
  }

  return data.map((r) => {
    const media = Array.isArray(r.media) ? r.media[0] : r.media;
    return {
      id: r.id as string,
      eventId: r.event_id as string,
      mediaAssetId: r.media_asset_id as string,
      storagePath: (media?.storage_path as string) ?? '',
      mimeType: (media?.mime_type as string | null) ?? null,
      kind: (media?.kind as EventMediaRow['kind']) ?? 'image',
      width: (media?.width as number | null) ?? null,
      height: (media?.height as number | null) ?? null,
      caption: (r.caption as string | null) ?? null,
      postedByUserId: r.posted_by_user_id as string,
      postedAt: r.posted_at as string,
    };
  });
}

export async function addEventMediaRow(args: {
  eventId: string;
  mediaAssetId: string;
  caption?: string;
}): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) throw new Error('Not signed in.');

  const { error } = await supabase.from('event_media').insert({
    event_id: args.eventId,
    media_asset_id: args.mediaAssetId,
    caption: args.caption?.trim() || null,
    posted_by_user_id: myUuid,
  });
  if (error) throw new Error(error.message);
}

export async function inviteEmailToEvent(
  eventId: string,
  email: string,
  displayName?: string,
): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  // Use the same defensive regex as createEvent's invite path so the two
  // entry points can't disagree on what counts as a valid invitee.
  const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  if (!EMAIL_RE.test(trimmed)) {
    throw new Error('Enter a valid email address.');
  }
  const { data: session } = await supabase.auth.getUser();
  const myUuid = session.user?.id;
  if (!myUuid) throw new Error('Not signed in.');

  const { error } = await supabase.from('event_guests').insert({
    event_id: eventId,
    user_id: null,
    invited_email: trimmed,
    display_name: (displayName?.trim() || trimmed.split('@')[0] || trimmed),
    rsvp: 'invited',
    invited_by_user_id: myUuid,
  });
  if (error) throw new Error(error.message);
}

# Reunion Mode — v0 plan

**Status:** Building. Target: real test at the Pilks July 2026 family reunion.
**Owner:** Aaron.
**Strategic frame:** Kin is now two-mode — long-term family memory (existing) + time-boxed reunions/vacations (this). See `memory/kin-event-mode.md` for the why.

---

## 1. Product shape

One app. Two relationship rings:

- **Immediate family** — declared per user at onboarding. Mom, Dad, siblings, grandparents. _Not_ cousins. This is who the "Ask" / legacy product runs against.
- **Extended family / family tree** — everyone you've ever added or co-attended an event with. Persistent. Used as the invite pool for events; never re-typed.

One concept on top: **Events** (reunions, vacations, holidays, gatherings). An Event:

- Can span multiple branches (Pilks reunion mixes Pilks + Smiths in the same room — divorced/blended).
- Has guests from immediate _and_ extended family, plus event-only guests.
- Has a working life cycle: planning → upcoming → happening → past.
- Captures activity during the event (photos, voice, text).
- Auto-stitches a **highlight reel** when it ends — and prompts guests to set up their own Kin. This is the K-factor moment.

---

## 2. What v0 must do for the July reunion

The minimum that lets Aaron's mom run a real reunion in July and have it feel like the product:

1. Create an Event (name, dates, host, branch(es))
2. Invite by phone/email (SMS magic link _deferred_ — see §4)
3. RSVP — Going / Maybe / Not coming
4. "What I'm bringing" — shared list, anyone can add or claim
5. Activity polls — pick the date, pick the place, vote on activities
6. Shared photo/video feed scoped to the event
7. Event home — countdown + tabs into the above
8. Highlight reel at event end — auto-generated montage + "set up your own Kin" CTA

Out of scope for v0:

- Real auth (still on the Batch 1 path — see SECURITY-REVIEW.md)
- Twilio SMS bridge (see §4)
- Money-release (deferred to Phase 3 per spec scope note)
- AI captioning / face detection / smart album sorting

---

## 3. Data model deltas

### New tables (migration `20260101000013_events.sql`)

- `events` — id, host_user_id, primary_circle_id, title, subtitle, kind (`reunion|vacation|holiday|gathering|other`), starts_at, ends_at, status, cover_tint, cover_glyph, location_text, deleted_at, created_at
- `event_circles` — many-to-many: events ↔ family_circles (cross-branch support)
- `event_guests` — event_id, user_id (nullable for not-yet-claimed invitees), invited_email, invited_phone, display_name, rsvp (`invited|going|maybe|no`), is_host, invited_by_user_id, invited_at, claimed_at
- `event_bring_items` — event_id, item_text, claimed_by_user_id, checked, created_by_user_id, created_at
- `event_polls` — event_id, kind (`date|location|activity|custom`), prompt, multiple_choice, closes_at, created_by_user_id
- `event_poll_options` — poll_id, label, subtitle, tint, position
- `event_poll_votes` — option_id, voter_user_id, voted_at
- `event_media` — event_id, media_asset_id (FK), caption, posted_by_user_id, posted_at
- `event_highlights` — event_id, generated_at, body (rich text / structured JSON), shared_url

### Schema deltas to existing tables

- `family_memberships.is_immediate` (boolean, default false) — per the viewer's _own_ membership, marks who the user counts as immediate family. We don't denormalize this onto a separate table because immediate-family is exactly a flag on the membership of _your circle_ from your perspective.
  - When Aaron lists Mom as immediate, this is a row in `family_memberships` for Aaron's view of Mom, not Mom's view of herself.
  - We'll need a small lookup helper — `is_immediate_to(viewer_id, member_id)` — but we can layer that on later.
- `relationships.is_extended_only` (boolean, default false) — flags relationships that exist only because of cross-event co-attendance (not declared by the user in onboarding). Lets us distinguish "you've met them at a reunion" from "they're in your family graph proper."

### RLS

Defer policies for these tables to the next hardening migration (Batch 1B). For v0 mock data the screens don't talk to the DB. When we wire real data:

- Event SELECT is gated by `event_guests.user_id = auth.uid()` OR primary_circle membership.
- Event INSERT goes through a SECURITY DEFINER `create_event()` that auto-inserts host as guest.
- Vote/Bring/Media inserts require event_guest membership.

---

## 4. Twilio SMS bridge — deferred to Phase 2

Aaron wants this. Build it last. The PartyFull mechanic (event messages also surface as native iMessages) is great UX but is a real lift: shortcode/RCS, two-way sync, group membership state, opt-out handling. For July: push notifications + iMessage share sheet for the invite link is 80% of the value at 5% of the cost. We'll write the spec for the SMS bridge as Phase 2 once v0 ships and Aaron has reunion footage.

Cost notes (rough — Aaron is verifying):

- Twilio A2P 10DLC SMS: ~$0.0083 per outbound segment + $0.0083 per inbound, plus brand/campaign fees (~$15/mo + $4/mo per campaign).
- For a 25-person reunion with ~200 messages/day over 3 days: ~$10–15 per reunion in SMS costs.
- That's fine if conversion to retained users is even 5% per reunion.

---

## 5. Screens (v0)

### Reusing / extending

- `(tabs)/index.tsx` Home — upcoming-event hero card moves above the daily prompt when one is within 30 days.
- `(tabs)/family.tsx` — adds "Immediate" vs "Extended" sections; adds "Upcoming events" preview.
- `moment/[id].tsx` — evolves into the proper Event home (renamed conceptually but route stays for link stability). Adds RSVP block, photos preview, highlights placeholder, cross-branch guest avatars.
- `new/moment.tsx` → upgraded to support event kind, multi-branch, extended-guest picker.

### New

- `/events` — list of upcoming + past events across all branches.
- `/moment/[id]/feed` — event photo/video feed.
- `/moment/[id]/guests` — full guest list with RSVP, search, add.
- `/moment/[id]/bring` — full bring list with add + claim flow.
- `/moment/[id]/highlights` — highlight reel viewer (empty pre-event; populated post-event).
- `/onboarding/immediate-family` — declare immediate family during onboarding.
- `/new/event` — alias of `/new/moment` with reunion-mode defaults (decide later if separate or just a param).

---

## 6. The handoff (the K-factor moment)

When the event ends:

1. App generates a highlight reel — best photos, top quotes, the bring list outcomes, who won the poll, the planning chatter that was funniest.
2. Every guest gets a push: _"Pilks Family Reunion 2026 — your highlight reel is ready."_
3. Reel viewer shows the montage.
4. End card: _"Want to keep this kind of memory going with your own family? Set up your Kin."_
5. CTA → `/onboarding/name` flow, pre-seeded with the user as "me" and the people they were closest to at the reunion as suggested immediate family.

This is the most important screen in the product. Spend time on it.

---

## 7. Build order (this batch)

1. Plan doc (this file). ✅
2. Schema migration `20260101000013_events.sql` — placeholders + RLS notes.
3. Shared types + zod schemas for Event / Guest / BringItem / Poll / Vote / Media.
4. Extend mockData: extended family registry, immediate-family ids, July reunion fully populated.
5. eventStore — RSVP, bring, poll, media mutations.
6. New screens — `/events`, `/moment/[id]/feed`, `/moment/[id]/guests`, `/moment/[id]/bring`, `/moment/[id]/highlights`.
7. Upgrade `moment/[id]` event home — RSVP, cross-branch, photos preview, highlights teaser.
8. Upgrade `new/moment` — kind picker, multi-branch, extended guests.
9. Family tab — immediate vs extended split, upcoming events row.
10. Home tab — hoist upcoming event hero when within 30 days.
11. Onboarding — immediate-family step.
12. Verify with `pnpm typecheck`. Don't push (Aaron runs locally).

---

## 8. Open questions for Aaron

- **Branch picker on event create.** Should "The Pilks" reunion default to all branches the user belongs to, or should they pick? Right now multi-branch users would have to pick — that's the divorced-family case. Reasonable default.
- **Event-only guests (no Kin account).** Should they get a magic link to a web view of the event, or do they need to install the app to RSVP? v0 plan: install required, but invite preview works in browser.
- **Money-release in the demo.** Codex wanted it gone. We kept it with a "concept" scope note. Should the UI carry a visible "concept" badge before Mom sees it in July? My take: yes. Easy fix; do it in this batch.

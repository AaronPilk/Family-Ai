# Go-Live Plan — Kin to Production

**Status:** Drafted 2026-05-21. Active.
**Goal:** Move Kin from polished prototype with mock data to a real product on the App Store and Play Store that real families can use.
**Honest estimate:** 3–4 weeks of focused work, broken into named batches.

---

## Why this doc exists

You said "wire the app up so it can go live." That's not one chat. It's a sequenced multi-batch effort with real external dependencies and one non-negotiable security gate. This doc names every batch, what's in scope, what's deferred, and what _you_ (not me) have to do at each step.

---

## Batches

### Batch A — Property tests for RLS hardening (1–2 days) **← starting now**

**Why first:** Your own `docs/SECURITY-REVIEW.md` says "Greenlight to wire real auth? Not yet" until C1–C4 are tested. `20260101000012_rls_hardening.sql` _claims_ to fix them; we have to _prove_ it.

- pgTAP scaffolding under `packages/db/tests/`
- One test file per Critical: `c1_recipient_immutable.sql`, `c2_vault_sealed_only.sql`, `c3_invite_required.sql`, `c4_soft_delete_propagation.sql`
- CI job `db-test` that runs `supabase test db` after migrations
- Tests must pass before Batch B opens

**External deps:** none. Aaron just runs locally.

### Batch B — Real Supabase auth (3–5 days)

- Hosted Supabase project (Aaron creates at supabase.com)
- Email/password sign-up + sign-in wired in `(auth)/sign-in.tsx` and `(auth)/welcome.tsx`
- Session refresh + persistence via `expo-secure-store`
- Replace the `ME` constant in mockData with `auth.uid()` everywhere
- Onboarding becomes a real user profile insert (name, last name, birthday, role, immediate-family declarations)
- Invites flow: SMS magic link is deferred (Batch F+), email link is enough for now

**External deps Aaron must do:**

- Create Supabase project at supabase.com
- Drop the project URL + anon key into `.env`
- Decide on email-only or also Apple Sign In / Google Sign In (Apple is recommended for App Store approval velocity)

### Batch C — Replace mock data with real Supabase queries (1–2 weeks)

The biggest batch. Every screen currently reads from mockData/stores. Each gets converted to React Query + Supabase:

- Branches → `family_circles` + `family_memberships`
- Members → `users` + `profiles`
- Feed → `memory_items` + `timeline_placements`
- Inbox (questions) → `question_recipients`
- Events → all the new event\_\* tables
- Group chat → `event_messages` (new table, see migration note below)
- Vault → `vault_items` + `vault_releases`
- Polls → `event_polls` + `event_poll_votes`
- Bring list → `event_bring_items`
- Reactions → `reactions` table

**Migration note:** Group chat currently uses `event_activity` semantically (the `MomentMessage` shape). A proper migration will introduce `event_messages` as a first-class table and remove `activity` JSON from event_highlights. Drafted in Batch C.

**External deps:** none beyond what Batch B set up.

### Batch D — Storage + media (2–3 days)

- Supabase Storage buckets: `media-photos`, `media-videos`, `media-voice`
- Storage path validation per `media_assets.storage_path` regex (M7 from security review)
- Edge function `mint_signed_url` for time-bounded read access
- Camera roll picker via `expo-image-picker`
- Voice recorder via `expo-av`
- Upload flow: client → bucket → edge function inserts `media_assets` row → memory created referencing it

**External deps:** none.

### Batch E — Edge Functions (2–3 days)

The functions currently stubbed in `supabase/functions/`. Make them real:

- `release_vault_items` — cron, transitions sealed/scheduled vaults to released when rules fire
- `tag_memory` — when a memory is created, run topic taxonomy match
- `transcribe_media` — OpenAI Whisper / Deepgram for voice notes → transcription rows
- New: `accept_invite`, `record_answer`, `transition_vault_item`, `post_chatter`, `generate_highlight_reel`

**External deps Aaron must decide on:**

- Transcription provider (Deepgram cheapest, OpenAI most accurate, on-device via Whisper.cpp is also viable)

### Batch F — Push notifications (1–2 days)

- Expo Push tokens stored per user
- Edge function `notify` triggered on key events (new question, vault about to release, event message you were tagged in, etc.)
- Per-user notification preferences honoring `notifications.read_at`

**External deps:** none (Expo Push is free).

### Batch G — App Store / Play Store submission (3–5 days, includes review time)

- Apple Developer Program account ($99/yr — Aaron has to enroll)
- Google Play Console account ($25 one-time — Aaron has to enroll)
- Privacy policy + terms of service hosted at a real URL (kin.family / kinmemory.com / whatever you pick)
- App icons (real, 1024x1024 + variants), splash screens, screenshots in 6.7" + 5.5"
- TestFlight build first (1-day Apple review, sometimes faster)
- Public submission (1–3 day Apple review)
- Google Play submission (same day for closed testing, 7 days for production)

**External deps Aaron must do:**

- Enroll in Apple Developer Program
- Enroll in Google Play Console
- Buy domain (if not done)
- Host privacy policy + ToS (the simplest is GitHub Pages; we'll write the policy)
- Get App Store screenshots designed (we can produce these from the Expo simulator)

---

## What's NOT in this plan (deferred per existing decisions)

- **Twilio SMS bridge** (PartyFull-style two-way text/in-app sync) — Phase 2 after launch
- **Money-release vault items** — Phase 3, needs legal/payment partner due diligence
- **Face auto-tagging** — needs on-device ML decision + cost-model resolution
- **Photo-book digitization** — needs camera + OCR pipeline + AI captioning
- **Real OpenTelemetry + Sentry** — set up after a small TestFlight cohort to keep noise low

---

## Order of operations

```
A (tests) → B (auth) → C (replace mocks) → D (storage) → E (edge fns) → F (push) → G (submit)
                                       ↘ each item in C can ship to TestFlight as it lands
```

Don't try to do C–F in parallel; auth needs to land first or every other batch is rebased on a moving target.

---

## What you (Aaron) need to do alongside

While I write code, you need to:

1. Create the hosted Supabase project (free tier is fine for testing; Pro at $25/mo when real users land)
2. Enroll in Apple Developer Program ($99/yr) — start now, takes a few days to approve
3. Enroll in Google Play Console ($25 one-time) — same, start now
4. Decide on domain + register it
5. Decide on transcription provider for Batch E
6. Write or commission privacy policy + ToS (I can draft both)
7. Get the App Store icon designed (or I can produce a simple but on-brand one)

---

## What happens after this plan

Once Batch G ships, the post-launch backlog is:

- Twilio SMS bridge (the K-factor amplifier)
- Highlight-reel auto-generation
- Face auto-tag (cost-modeled)
- Photo-book digitization
- Money-release with legal partner
- A web companion at kin.family for the magic-link landing page

---

## How to track progress

This doc gets updated as batches complete. Each batch closes with a commit on `main` whose message starts with `Batch <X>:`. The CHANGELOG.md mirrors batch completions.

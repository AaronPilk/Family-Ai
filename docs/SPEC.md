# Family AI — Product Specification (v1)

> Working title: **Kin** (placeholder — final name TBD). This document treats the product as one focused app. Everywhere it says "Kin" or "the app," swap in your final name.

> Positioning: **"Ask your family anything. Save every answer forever."**

> One-line definition: A private family memory network where on-demand questions, answers, posts, voice notes, and videos become part of a permanent, AI-organized family archive — owned and controlled by the family.

---

## Table of Contents

- A. Full product summary
- B. MVP definition
- C. User personas
- D. Core user flows
- E. Main screens
- F. Feature list by phase
- G. Technical stack recommendation
- H. Database schema
- I. Privacy & permissions model
- J. AI feature architecture
- K. UI/UX design guide
- L. Monetization plan
- M. Roadmap
- N. Build plan in small batches
- O. Risks & hard problems
- P. v1 build prompt for a coding agent

---

## A. Full Product Summary

### The problem

Families lose stories the moment people stop being around to tell them. The little stuff — what your mom snacked on as a kid, the song your dad played in the car, what your grandma whispered the first time she held you — is the texture of a family, and almost none of it gets saved. The big stuff (weddings, births, funerals) gets photos. The small stuff vanishes.

Existing tools each solve part of this and miss the rest:

- **Instagram/TikTok**: built for performance, not preservation; public-by-default; algorithmic; not safe for family.
- **iMessage/WhatsApp**: ephemeral by design, messages get buried, no structure, no archive, no shared timeline.
- **Storyworth/Remento**: lovely but unidirectional — one elder, one prompt a week, one book per year. They don't capture the _random_ in-the-moment questions that are the most valuable.
- **Shared photo albums (Google Photos, Apple Shared Library)**: just images; no questions, no relationships, no story.
- **Ancestry/MyHeritage**: backward-looking genealogy; not designed for living conversation.

No app is built around the unit of memory that matters most: **a question one person asks another person in their family, and the answer that comes back, captured in a place where it will live forever.**

### The product

Kin is a private mobile app where a family creates a **circle**, maps their **relationships**, and uses three core behaviors over time:

1. **Ask** — anyone can ask anyone in the family a question at any moment. Text, voice, or video. Big questions ("What advice do you want me to have?") or tiny ones ("What did you put on Chicken in a Biskit crackers?").
2. **Answer** — replies come back as text, voice note, or video. The answer is saved permanently into multiple places at once: the responder's personal archive, the asker↔responder relationship timeline, optionally the family feed, optionally a topic timeline (Food, Childhood, Love, Faith, etc.).
3. **Share & React** — a private, Instagram-style feed lets the family post photos, milestones, throwbacks, polls, and imported social posts. Reactions and replies become part of the archive too.

A **Vault** lets a person record messages that release in the future — on a date, a birthday, a milestone, or after death. A **timeline engine** keeps every person's life, every relationship, and every topic auto-organized. An **AI layer** transcribes voice/video, tags content, suggests follow-up questions, and turns scattered answers into chapters of a living family book.

### Why now

- Phones can record studio-quality voice and 4K video natively.
- Whisper-class transcription is cheap and accurate.
- LLMs can organize unstructured life-story content into coherent timelines and books for the first time.
- An aging-parent generation is rapidly adopting iPhone, FaceTime, and iMessage. They will use a _familiar_ interface (Instagram-like) but won't use one that feels public or technical.
- Younger generations regret not asking questions and want a structured way to do it.

### The unique wedge

Every competitor either captures the elder's story in long-form (Storyworth, Remento) or captures real-time chatter (iMessage, WhatsApp). **Nobody captures the in-the-moment question.** That's the wedge. Once captured, those questions and answers compound into something no other tool can produce: a searchable, organized, two-sided story of every relationship in a family.

### What Kin is NOT

- Not a social network. There is no follower count, no public posts, no algorithm trying to maximize engagement.
- Not a chat app. Messages are not the unit; _memories_ are.
- Not a genealogy tool. We don't care about your great-great-grandparents (yet).
- Not a cloud storage product. We are not "Dropbox for family." Storage is the floor, not the ceiling.

---

## B. MVP Definition

The MVP must prove a single hypothesis: **families will adopt on-demand questions as a habit, and the resulting timeline becomes emotionally valuable enough that they keep paying.**

### MVP scope — IN

Authentication & onboarding (3 steps after sign-in)

- Email + Apple Sign-In + phone (SMS) auth
- **Step 1 — Name your family.** Text input. Default to _just one_ family/branch. Copy: "Most families use one group. If yours is more complex (divorced parents, in-laws, chosen family), you can add more from Settings."
- **Step 2 — Invite the first person.** Name + phone/email + relationship picker (parent, child, sibling, grandparent, stepparent, stepsibling, partner, aunt/uncle, cousin, custom). Skippable.
- **Step 3 — How Kin works.** One screen that explains the fan-out: when Mom answers a question, her words live in **three** places — her own life story, the relationship between you and her, and the relevant topic timeline. This is the most important UX moment in the entire app; it removes the "I don't get how this is organized" feeling on first run.
- Profile setup happens inline (the user IS their own first profile via the chosen display name + auth).

Branch model (one by default; more when needed)

- The default state is **one branch** — your family. The "circle/branch" abstraction is invisible to single-family users; they just see "your family."
- A second branch appears when the user explicitly creates one OR accepts an invite from a different family. From there the branch switcher appears at the top of Home, Ask, and Family screens. It hides itself when only one branch exists.
- Use cases for multi-branch: divorced parents (Mom's side + Dad's side), blended families (bio family + step family), in-laws (your family + partner's family), chosen family (separate from biological).
- **Default branch naming uses the surname**, not the relationship label. "The Pilks" / "The Smiths" / "The O'Connors" — that's how people actually talk about their families.
- **"All my family" combined view.** When the user has 2+ branches, the switcher exposes a top option called "All my family" that aggregates Home/Ask/Family content across every visible branch. Use it for the daily-driver feed; switch to a specific branch for "I want to ask Mom something without Dad seeing it."
- Each branch has its own feed, timelines, members, and vault scope. Visibility rules naturally inherit branch scope — content in one branch never crosses into another.
- Schema-wise: each branch is a `family_circles` row; a user has one `family_memberships` row per branch.

The Ask flow (the core)

- Floating Ask button on every primary screen
- Choose recipient(s) — single or multi
- Compose: text, voice (record-in-place), or attach a photo/short video as context
- Visibility selector (default: just you + recipient)
- Send; recipient gets a push: _"Aaron asked you a memory question."_

The Answer flow

- Inbox of pending questions
- Tap to answer with text, voice, or video (in-app recording, up to 3 minutes for MVP)
- "Save draft" + "Answer later" reminders
- Visibility inherits from the question; recipient can broaden or narrow

Storage of answers across three places

- Responder's **personal timeline**
- The asker↔responder **relationship timeline**
- The **family feed** if visibility allows

Private family feed

- Vertical scroll, Instagram-style
- Post types: photo, video, text memory, throwback, milestone, question, poll (Phase 2)
- Each post carries a visibility rule
- Comments (text, voice note, emoji reaction) become part of the timeline

Basic Vault

- Record a video/audio/text and pin a release rule: **release now**, **release on date**, **release on someone's birthday**, **release at age N**, **release manually**. Death-triggered release is Phase 2 (requires a verification process).
- Vault items show up in the timeline once released.

Basic timelines

- Personal timeline (one per profile)
- Relationship timeline (one per directional pair)
- Family timeline (the circle as a whole)
- Topic timelines for MVP: **Childhood, Food, Love, Advice, Faith, Holidays, Funny stories, Lessons** (auto-tagged by AI; user can re-tag)

AI v1 (helpful, not intrusive)

- Transcription for all voice/video (Whisper-class)
- Auto-tagging into topic timelines (Claude-class summarizer + classifier)
- Search across the family archive (Postgres full-text + pgvector semantic)
- "Suggested follow-up questions" after an answer is given

Notifications

- New question for you
- Someone answered your question
- Someone posted in the feed
- Vault item is about to release
- Weekly digest: _"This week in your family — 4 new memories"_

Settings

- Manage circle members
- Edit relationships
- Visibility defaults
- Notification preferences
- Export my data (zip of media + JSON)
- Delete account / leave circle

### MVP scope — OUT (deferred)

- Social media auto-import via official APIs (use share-extension only)
- Book/PDF export
- Family tree visualization
- Death-triggered vault release (requires legal/verification design — Phase 2)
- Video editing, montages, audio memoirs
- AI chat trained on family memories
- Multiple circles per user (single circle in MVP)
- Web app (iOS-only at launch; Android Phase 2)

### MVP success metrics

- **Activation**: % of invited members who post or answer within 7 days (target: 60%+)
- **Habit**: weekly active families (≥3 members active in a 7-day window). Target: 40% of paying families.
- **Core action density**: average questions asked per active family per week (target: ≥4).
- **Retention**: month-3 family retention (target: 55%+).
- **Emotional resonance** (qualitative): NPS ≥ 50; "would you pay $X to keep this forever?" survey.

---

## C. User Personas

Five personas. Three are critical for the MVP (Aaron, Linda, Grace). Two appear at scale (Mike, Sara).

### 1. Aaron — "The Initiator" (35, founder, has two young kids)

- Owns an iPhone, comfortable with any app.
- Has the _impulse_ to ask his mom things, often when triggered by a small daily moment.
- Is the one who installs the app, invites his parents, and drives early adoption.
- Pain points: keeps thinking of questions and forgetting them; doesn't want to interrupt his mom with a long call; wants the answers preserved for _his own_ kids.
- Wants: speed (ask in under 15 seconds), guarantee that nothing is lost, beautiful surface to look back on.
- Will pay: yes, $10–20/month, but only if his family actually uses it.
- Risk of churn: if mom and dad don't engage in the first 2 weeks, he stops asking.

### 2. Linda — "The Keeper" (62, Aaron's mom, retired teacher)

- Has an iPhone but uses ~6 apps. Facebook, Messages, FaceTime, Photos, weather, banking.
- Loves the _idea_ of leaving stories for her kids and grandkids but feels paralyzed by Storyworth's weekly prompts ("I don't know what to write").
- Way more comfortable talking than typing.
- Pain points: doesn't want to feel "old"; doesn't want to do anything that feels like homework; doesn't want a confusing interface; doesn't want to broadcast.
- Wants: a question from someone she loves with a clear "tap here to record" button, no pressure, easy to skip.
- Risk: friction kills her. If the answer flow takes more than 2 taps + recording, she abandons.

### 3. Grace — "The Matriarch" (84, Aaron's grandmother)

- Owns an iPhone her son set up. Uses FaceTime and Photos.
- Will not download an app on her own.
- Onboarding must be done _by Aaron during a visit_, with her account effectively co-piloted.
- Her contributions are the most valuable in the family archive — her stories are running out of time.
- Pain points: small text is hard to read; gets confused by modals; recordings need to be effortless.
- Wants: a single screen that shows: "Aaron asked you a question. Tap to listen. Tap to reply."
- Risk: any error state (network failure, permission denial) and she's gone for a month.

### 4. Mike — "The Sibling" (38, Aaron's brother, low-engagement)

- Will install the app because Aaron invited him.
- Won't open it weekly. Will open it when notified.
- Mostly a _reader_ and _liker_, not a poster.
- Pain points: feels guilt about not engaging more; doesn't want notification spam.
- Wants: low-effort presence, occasional batched "highlights from your family this month" email, easy to react.
- Risk: notification fatigue and he mutes the app, then forgets it exists.

### 5. Sara — "The Future Child" (currently age 4, eventually 18+)

- Not a current user.
- Is the _reason_ the product exists.
- Will inherit the archive: Aaron's vault messages to her, Linda's videos, Grace's stories.
- The product must hold up over 15+ years: data must remain readable, accounts must be transferable, accessibility must improve as she grows up _and_ as the elders pass on.

### Persona-driven design principles

- Build for **Linda first**. If Linda can use it, everyone can. Aaron will tolerate compromises Linda won't.
- Optimize Grace's screens for **one action at a time** with text 1.5x larger than default.
- Optimize Aaron's flow for **speed of capture** — fewer than 3 taps to ask, never let him forget a thought.
- Send Mike **fewer, better** notifications and a real digest.
- Design every piece of data assuming Sara will read it in 2040. Schema, exports, and account-transfer flows must outlive any one user.

---

## D. Core User Flows

The flows below are written as numbered steps with screen names, primary actions, and edge cases. Each flow names the database tables it touches; see section H for schema details.

### Flow 1 — First-time setup (Aaron creates a circle and invites Linda)

1. **Welcome screen** → Aaron taps "Get Started."
2. **Auth** → Apple Sign-In. (Touches: `users`, `profiles`.)
3. **Profile setup** → name, photo, birth year, optional tagline. (Touches: `profiles`.)
4. **Create or join** → Aaron picks "Start a new family." Enters family name ("The Pilks").
5. **Invite first members** → Aaron taps + Add and enters Linda's phone or email + picks her relationship to him ("parent"). Repeat for Dad, Mike, Grace. Each invite creates a pending row. (Touches: `family_circles`, `family_memberships`, `relationships`, `invites`.)
6. **Send invites** → each pending member gets an SMS or email with a deep link. The link opens the app (or App Store) and auto-binds the invite to their account on signup.
7. **Default visibility chooser** → "Who should see new things you post by default?" Options: Everyone, Just me + recipient, Specific people. Default: _Just me + recipient_. (Touches: `profiles.default_visibility_rule_id`, `visibility_rules`.)
8. **Suggested first question** → "Want to ask your mom something to get started?" with 3 example prompts. Skips to Flow 2.

**Edge cases**

- Linda doesn't have the app → SMS link includes a fallback web page explaining what Kin is and a "Download" button. Invite stays pending up to 30 days.
- Two family members invite the same person → second invite is consolidated into the same pending invite, not a duplicate.

### Flow 2 — Asking a question (Aaron asks Linda about Chicken in a Biskit)

1. **Tap floating Ask button** on Home / Timeline / Family screen.
2. **Recipient screen** → list of family members with avatars. Aaron taps Linda. (Single or multi-select; default single.)
3. **Compose screen** with three input modes (Text / Voice / Camera) and an optional "Add context" affordance (camera roll, link, screenshot).
   - Aaron types: "Mom — what did you eat Chicken in a Biskit crackers with when you were a kid?"
   - Adds a photo of the cracker box he saw at the store.
4. **Visibility selector** (collapsed by default, shows current value as a chip: _Just you and Mom_). Aaron leaves as-is.
5. **Send** → optimistic UI shows the question moving to the relationship timeline; push fires to Linda.
6. (Touches on send: `memory_items` (kind=`question`), `memory_media`, `question_recipients`, `timeline_placements` (×2: Aaron's personal, Aaron↔Linda relationship), `notifications`.)

**Edge cases**

- Network failure on send → queue locally, retry; user sees a small "Sending…" chip, never a destructive error.
- Recipient is not in the circle yet (Aaron tries to ask a not-yet-joined invitee) → question is held in "pending recipient" state and delivered the moment they join.

### Flow 3 — Answering a question (Linda gets the push)

1. **Push notification**: _"Aaron asked you a memory question. 🥨"_
2. Tap → **Question detail screen**: Aaron's question + photo context displayed large; one big primary button: **Answer**.
3. **Answer mode chooser** → three big rounded cards: **Voice** (default, most prominent), **Video**, **Type it**. Linda taps Voice.
4. **Recording screen** → giant pink mic button, waveform, timer. Tap to start, tap to stop. After stop: **Send** / **Re-record** / **Add a note**.
5. Linda taps Send. (Touches: `memory_items` (kind=`answer`, `related_question_id=Q`), `memory_media` (audio), `transcriptions` (queued), `timeline_placements` (×3+: Linda's personal, Aaron↔Linda relationship, Topic:Food via AI tag, Family feed if visibility allows), `notifications` to Aaron.)
6. AI side-effects (async, do not block UX):
   - Whisper transcription written to `transcriptions`
   - Auto-tagging → `ai_tags` row with topic = `food`, confidence 0.92
   - Suggested follow-up question stored as a `prompt_suggestion` row for Aaron

**Edge cases**

- Linda hits Cancel mid-recording → draft is saved; question stays in inbox with "Draft saved" badge.
- Linda is offline → recording finishes locally, queues for upload, retries on next network availability. Push to Aaron deferred until upload confirmed.
- Linda wants to answer later → "Remind me" sets a notification for tomorrow morning; question stays pinned in inbox.

### Flow 4 — Posting to the feed (Aaron shares a throwback)

1. From Home, tap **+** in top right → **New post**.
2. Choose media (camera roll, in-app camera, or text-only).
3. Add caption.
4. Visibility chip: _Everyone in family_ (default for feed posts).
5. Tap **Post**. (Touches: `memory_items` (kind=`post`), `memory_media`, `timeline_placements` (Family feed + Aaron's personal).)
6. Family members see in feed; can react / comment. Comments become `memory_items` with `parent_memory_id` and their own timeline_placements.

### Flow 5 — Importing a social post for response (Phase 1.5)

1. From any external app (Instagram, TikTok, Safari), Aaron taps **Share → Kin**.
2. Kin opens a sheet: **Save as memory prompt** with options:
   - Pick recipients ("Ask Mom to react")
   - Add a personal note
   - Choose visibility
3. Tap Save. (Touches: `memory_items` (kind=`imported_post`, `imported_source` JSONB with URL + screenshot ref), `memory_media`, optional `question_recipients` if framed as a prompt.)
4. Recipients see the imported post as a card with the family member's note, and can reply privately with text/voice/video.

### Flow 6 — Creating a Vault message (Linda records a video for Aaron's first child)

1. From Vault tab → **+ New vault item**.
2. Compose (text/voice/video). Linda records a 2-minute video.
3. **Release rule** sheet:
   - Release on date
   - Release on someone's birthday
   - Release when [person] turns [age]
   - Release when [person] reaches milestone (Phase 2: birth of child, marriage)
   - Release manually
   - Release after my death (Phase 2 — requires named verifier(s))
4. Recipients selector (defaults to herself if not chosen).
5. Preview → Confirm. (Touches: `memory_items` (kind=`vault_message`, visibility=`vault`), `vault_items` with `release_rule` JSONB.)
6. Until release, the item is encrypted-at-rest (server-side) and visible only to Linda. On release trigger (cron / event hook), the item flips to its post-release visibility, fires push to recipients, and gets placed into the relevant timelines.

### Flow 7 — Browsing a relationship timeline (Aaron opens Mom)

1. Family tab → tap **Linda's avatar**.
2. Profile header (photo, relationship label "Mom", age, "27 memories together").
3. Tabs: **Timeline** (default) / **Questions** / **Vault for me** (if any).
4. Timeline is a vertical, chronological list of every memory item between Aaron and Linda, grouped by month, with AI-generated section titles ("Spring 2026: a flurry of food memories").
5. Each item is tappable, plays inline (video/audio) or expands (text/photo).
6. Top of screen has **Ask Mom** quick action.

### Flow 8 — Searching the archive (Aaron looks for the Chicken in a Biskit answer)

1. Tap search icon. Type "chicken biskit crackers."
2. Results pane shows ranked hits across questions, answers, posts, comments, vault items the user has permission to see. Each hit shows the snippet + who said it + when.
3. Tap to jump to source. (Touches: Postgres FTS + pgvector semantic search; filtered by RLS.)

---

## E. Main Screens

The app uses a 5-tab bottom bar plus a global floating **Ask** button. Screen names below are stable identifiers; treat them as the canonical route names.

### Global

- **Bottom tab bar (5 tabs)**: Home · Ask · Vault · Timeline · Family
- **Floating Ask button**: appears on Home, Timeline, Family. Hidden on Ask tab (would be redundant), Vault (different intent), and during media capture.
- **Top bar**: contextual; always white; centered title; left = back or profile; right = action (search, +, settings).

### 1. Home (Family Feed)

- Vertical feed of `memory_items` placed on the Family timeline + answers that have feed-level visibility.
- Stories rail at top (last 24h of unread activity per member; tap to see).
- Each card: author avatar + name + relationship-to-you ("Mom"), timestamp, content, visibility chip, reactions, comment button, "Save to my timeline" affordance.
- Empty state: warm illustration + "Ask the first question" CTA.

### 2. Ask

- Full-screen action. Defaults to opening the recipient picker, not a blank text field — choosing a person is the more important decision.
- Step 1: Recipients (single or multi-select). Suggested ("People you haven't asked lately") at top.
- Step 2: Compose (text / voice / video). Voice is the default mode for elders' UX.
- Step 3: Visibility chip + optional Topic chip ("Childhood, Food…")
- Big rose **Send** button bottom-fixed.

### 3. Vault

- Two segments: **My Vault** (items I created) and **For Me** (items released to me).
- Empty state: explainer card "Leave a message for the future" with one-tap to record.
- Each vault item shows: title (or auto-generated), recipients, release rule in plain English ("Releases on Sara's 18th birthday — Mar 14, 2040"), media preview, status pill.
- - button creates new vault item (Flow 6).

### 4. Timeline

- Segment control: **Mine** · **Family** · **People** · **Topics**.
- **Mine**: my own personal timeline, reverse chrono with AI section headers.
- **Family**: shared circle timeline, the macro view.
- **People**: list of family members; tap to see Aaron↔X relationship timeline.
- **Topics**: chips for Childhood, Food, Love, Advice, Faith, Holidays, Funny stories, Lessons. Tap to see topic timeline (cross-family).

### 5. Family

- Family circle header: name + member avatars.
- Members list with relationship labels ("Mom", "Dad", "Grandma", "Brother").
- Tap a member → Profile detail screen (header + tabs as in Flow 7).
- **Invite** button.
- **Family settings** (admins only): rename circle, manage members, transfer admin, leave circle, delete circle.

### Other key screens

- **Profile detail** (any member): header, "Ask [name]" button, tabs Timeline / Questions / Vault-for-me / About.
- **Question detail**: question card on top, answer thread below (multiple recipients can answer).
- **Answer composer**: voice (default) / video / text, with visibility + topic chips.
- **Recording sheet**: full-screen black background, large mic/camera, waveform, 1-tap stop, instant playback.
- **Visibility editor**: bottom sheet listing options (Everyone, Just us, Specific people, Only me, Vault). One-tap selection.
- **Search**: full-screen, recent + suggested queries, results grouped by type.
- **Notifications**: inbox list (with read/unread).
- **Settings**: account, notifications, privacy defaults, data export, delete account.
- **Onboarding** (4 screens): What is Kin → Sign in → Create/Join circle → Invite first member.

---

## F. Feature List by Phase

This is the canonical feature ledger. Build top-down; do not skip ahead.

### Phase 0 — Foundations (weeks 1–2, infra only, no user-visible features)

- Repo setup (mobile, backend, infra)
- Supabase project (dev, staging, prod), Postgres extensions: `uuid-ossp`, `pgcrypto`, `vector`, `pg_trgm`
- Migrations system (Supabase migrations via CLI)
- CI (lint, type-check, test, EAS build)
- Sentry + a privacy-respecting analytics pipeline (PostHog self-host or Amplitude with opt-in)
- Design system tokens (see section K)
- Reusable mobile component library (Button, Card, BottomSheet, RecordingControl, Avatar, VisibilityChip)

### Phase 1 — MVP (months 1–4)

The entire MVP scope from section B, **plus** two structural items pulled forward from Phase 3 after user research:

- **Multi-branch family model** (was Phase 3). A user belongs to one or more **branches** within their account. Each branch has its own members, feed, timelines, and vault. Asks and posts in one branch never appear in another. This is non-negotiable for divorced/blended/chosen-family situations, which are the majority case, not the edge case.
- **Today homepage** (diary-first). The default home tab opens to a single prompt the user can answer right now, plus their inbox of questions from family, plus a thin recent-activity strip per branch. The Instagram-style feed exists but is secondary, not primary.

Everything else: Auth & onboarding · Branch create/join · Invites (SMS, email, share link) · Relationships · Profiles · Ask flow · Answer flow (text/voice/video, 3-min cap) · Visibility model · Branch feed · Posts (photo, video, text, throwback, milestone) · Comments (text + emoji + voice note) · Personal/Relationship/Branch/Topic timelines · Topic timelines (auto-tagged) · Basic Vault (date/birthday/age/manual releases) · Whisper transcription · Topic auto-tagging · Search (FTS + semantic) · Push notifications · Weekly digest · Data export · Account deletion

### Phase 2 — Depth (months 5–8)

- Social import via iOS Share Extension (no API integrations)
- Video memory replies on imported posts
- Family tree visualization (read-only)
- **Photo book digitization** — point the phone at each page of a physical album; OCR + image segmentation extracts every photo, AI groups them by era and event, user assigns people. Each extracted photo flows into the relevant personal/branch/topic timelines. This is a moat: nobody does this well, and analog family albums are decaying right now.
- More advanced vault releases: milestone triggers (first child, marriage, anniversary)
- **Money-release vault items** — Stripe-backed scheduled transfers tied to a release rule ("$25K to Sara on college graduation"). Funds held in escrow; recipient claims on release. Requires payment integration, KYC, and partnerships with a custodial / trust-account provider. Real legal lift, real differentiation. **Scope note (post-Codex review):** the *concept* lives in the v0 demo to validate the UX. Production money-release ships **no earlier than Phase 3** — it needs legal counsel, payment-partner due diligence, fraud controls, AML/KYC, dispute handling, and explicit jurisdictional review. Until then the UI carries an "in concept" badge and the money fields are not write-enabled against any real backend.
- **Death-triggered vault release** with named verifiers + legal hold flow + 14-day cool-off
- **Family Moments** (pulled from Phase 3 after user research). A planning + event surface scoped to a single real-world family event (vacation, reunion, holiday). Inside one Moment: date voting, location voting (with photo cards), packing/menu lists with assignees, planning chatter. During the event: photos/voice/video auto-collect into the Moment's timeline. After the event: the whole thing — votes, lists, chatter, media — becomes a chapter in the family book. The deliberate distinction from "WhatsApp for families": planning artifacts are _archived as memory_, not ephemeral chat.
- AI book/PDF export (per person, per relationship, per Moment)
- AI-generated chapter titles & summaries
- Audio-only memoir mode
- Android client (parity feature set, lower priority than depth)
- Family admin tools (multiple admins, role-based controls)

### Phase 3 — Compounding (months 9–18)

- AI chat trained on your family memories ("Ask the archive")
- Auto-generated highlight reels (annual recap, "your year with Mom", "Tahoe 2026 in 90 seconds")
- Printed keepsake products (hardcover books, audio CDs, framed timelines)
- Web app (read-only first, then create/edit)
- Public memory imports via official APIs where stable (Instagram, TikTok)
- Inheritance protocol (account transfer to a successor on death)
- Family events / "memory days" (low-key calendar of prompts)

### Phase 4 — Long-tail (year 2+)

- Languages beyond English (start with Spanish, then ES-MX/Portuguese)
- Voice cloning for narration (with strict consent + watermarking)
- Generational handoff to a child user when they come of age
- Genealogy integrations
- Therapist / hospice partnerships (legacy programs)
- Family-office / estate-planning integrations
- API for grief / memorial sites

---

## G. Technical Stack Recommendation

### Recommended stack (MVP)

**Mobile client: React Native (Expo, EAS) with TypeScript.**

- **Why:** ~2x faster to ship than native Swift; one codebase for iOS today and Android in Phase 2; Expo handles auth (`expo-auth-session`), media (`expo-image-picker`, `expo-av`, `expo-camera`), notifications (`expo-notifications`), and the iOS Share Extension via config plugins.
- **Where to go native:** the recording surfaces (audio/video) deserve a thin native module wrapper for buttery feedback; use `react-native-vision-camera` for camera and `react-native-audio-recorder-player` (or a small custom AVAudioRecorder bridge) for audio. The recording experience is the single most important interaction in the app; do not let it feel laggy.
- **UI:** Tamagui or NativeWind (Tailwind for RN). Recommendation: **Tamagui** — better performance via compilation, design tokens map cleanly to the spec in section K.
- **Animation:** `react-native-reanimated` v3 for everything. Avoid jank at all cost — Linda will notice.
- **State:** TanStack Query for server state + Zustand for ephemeral UI state. Avoid Redux.
- **Local persistence/offline queue:** MMKV for fast key-value; `expo-sqlite` or WatermelonDB for the offline outbox of pending sends.

**Trade-off honestly stated:** if budget allows a 2-engineer iOS-only build, **Swift + SwiftUI native** would yield a slightly tighter feel for Linda and Grace. The recommended React Native path is the better business decision (Android later, web later, one team). If the founder is non-technical and hiring one contractor, RN is clearly the right answer.

**Backend: Supabase (managed Postgres + Auth + Storage + Edge Functions + Realtime).**

- **Why:** the visibility model (per-row, per-relationship, per-circle) is a textbook Postgres Row-Level Security problem. Doing this on Firebase would be painful (Firestore rules don't compose well for relational permissions). Supabase ships:
  - Postgres with `pgvector` for semantic search and `pg_trgm` for fuzzy text
  - Auth with magic links, OAuth (Apple), and phone (SMS via Twilio)
  - Storage with signed URLs, S3-backed, RLS-aware
  - Edge Functions (Deno) for serverless triggers (vault release cron, AI pipelines)
  - Realtime for live feed updates and comment streams
  - One vendor, one bill, fewer integrations to wire.

**Media storage path:** start on Supabase Storage; move large video to **Cloudflare R2 + Stream** once monthly egress exceeds ~5TB. Build the media table to be storage-provider-agnostic so the migration is later-Aaron's problem, not v1-Aaron's problem.

**AI services:**

- **Transcription:** OpenAI Whisper API (or Deepgram Nova-3 for cheaper + faster English). Choose Deepgram for cost at scale; start with Whisper for simplicity.
- **Categorization, summarization, follow-up suggestions:** Anthropic Claude (Haiku for high-volume tagging, Sonnet for chapter summaries and book generation).
- **Embeddings for semantic search:** `text-embedding-3-large` (OpenAI) or `voyage-3` stored in pgvector. Voyage-3 is currently best per-dollar; either works.
- **Image content tags** (Phase 2): Anthropic or a vision model for "is this a photo of food/people/text/document."

**Push notifications:** Expo Push Service for MVP (free, easy, abstracted). Migrate to direct APNS for Android parity + richer payloads when needed.

**Search:** Postgres full-text (`tsvector`) for keyword + pgvector cosine similarity for semantic. Combined re-rank in app code with a tunable hybrid score (BM25-ish FTS + embedding distance). No Elasticsearch in MVP.

**Background jobs:** Supabase Edge Functions triggered by:

- Storage `INSERT` (new media → enqueue transcription)
- Database `INSERT` on `memory_items.kind='answer'` (→ enqueue tagging + follow-up suggestion)
- Scheduled cron (`pg_cron`) every 15 min for vault release checks
- Manual triggers from app for retries

For long-running tasks (book exports), add a small Cloudflare Worker or fly.io worker with a queue (Inngest or QStash) in Phase 2.

**Telemetry:** PostHog (self-hosted at scale) — events should be **non-content** (we never log the body of a question). Sentry for errors with PII scrubbing.

**Why not Firebase:** rules don't model "user X may read row Y because X is in circle C which contains relationship R that has visibility V" cleanly. You'd end up duplicating data and writing complex security rules. Postgres + RLS handles this with composable SQL policies.

**Why not Swift native + custom Node backend:** doubles the platform surface, doubles the build time, and you reinvent Auth, Storage, RLS, and Realtime — none of which are your differentiator.

**Why not Flutter:** smaller iOS community, harder to hit Apple-tier polish, and Dart costs you ecosystem (Expo's Share Extension story is mature, Flutter's is not).

### Summary table

| Layer            | Choice                                                           | Why                                                        |
| ---------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Mobile           | React Native + Expo + TypeScript                                 | One codebase, fast, mature media + share-extension support |
| UI lib           | Tamagui                                                          | Compiled, fast, tokenizable                                |
| State            | TanStack Query + Zustand                                         | Server cache + simple local state                          |
| Offline          | MMKV + outbox table                                              | Linda's Wi-Fi drops; never lose a recording                |
| Backend          | Supabase (Postgres + Auth + Storage + Edge Functions + Realtime) | RLS is perfect for the permission model                    |
| Media            | Supabase Storage → Cloudflare R2 + Stream later                  | Provider-agnostic media table                              |
| AI transcription | Whisper or Deepgram                                              | Cheap, accurate                                            |
| AI reasoning     | Claude (Haiku + Sonnet)                                          | Best instruction following for tagging/summaries           |
| Search           | Postgres FTS + pgvector                                          | No second search infra needed                              |
| Push             | Expo Push → APNS later                                           | Easy MVP, swap when needed                                 |
| Analytics        | PostHog (no-content), Sentry                                     | Privacy-respecting                                         |

---

## H. Database Schema

### Design principles

1. **Content lives in one place.** A single video answer is one row in `memory_items` + one row in `media_assets`. It appears in multiple timelines via `timeline_placements`, never duplicated.
2. **Polymorphic `memory_items` keyed by `kind`.** One table for questions, answers, posts, comments, vault messages, imported posts, milestones. Type-specific columns are nullable or live in a `meta` JSONB.
3. **Visibility is a separate, reusable concept.** `visibility_rules` rows can be referenced from many `memory_items`. Default visibility lives on the user's profile.
4. **All access goes through Row-Level Security.** Application code does not filter content; the database does. This is the single biggest safety lever.
5. **Soft delete everywhere.** A `deleted_at` column on every user-visible table; the app filters them; only an explicit "purge" job removes rows (after the legally required retention window).
6. **All times in UTC.** All timestamptz. Client renders in local TZ.

### Core tables

```sql
-- =========================================================
-- IDENTITY
-- =========================================================
create table users (
  id              uuid primary key default uuid_generate_v4(),
  email           citext unique,
  phone           text unique,
  apple_sub       text unique,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table profiles (
  user_id                     uuid primary key references users(id) on delete cascade,
  display_name                text not null,
  avatar_url                  text,
  birth_year                  int,
  birth_date                  date,                       -- optional, used for birthday-triggered vault
  tagline                     text,
  default_visibility_rule_id  uuid references visibility_rules(id),
  notification_prefs          jsonb not null default '{}'::jsonb,
  text_size_scale             numeric(3,2) not null default 1.0,  -- accessibility
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- =========================================================
-- FAMILY
-- =========================================================
create table family_circles (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  created_by    uuid not null references users(id),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table family_memberships (
  id            uuid primary key default uuid_generate_v4(),
  circle_id     uuid not null references family_circles(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  role          text not null check (role in ('admin','member','co_pilot')),
  joined_at     timestamptz not null default now(),
  removed_at    timestamptz,
  unique (circle_id, user_id)
);

-- relationship is directional. Aaron→Linda = 'parent', Linda→Aaron = 'child'.
create table relationships (
  id                  uuid primary key default uuid_generate_v4(),
  circle_id           uuid not null references family_circles(id) on delete cascade,
  from_user_id        uuid not null references users(id),
  to_user_id          uuid not null references users(id),
  relationship_type   text not null,   -- 'parent','child','grandparent','grandchild','sibling','spouse','aunt_uncle','niece_nephew','cousin','chosen_family','custom'
  custom_label        text,
  confirmed_by_to     boolean not null default false,    -- counterparty confirmed
  created_at          timestamptz not null default now(),
  unique (circle_id, from_user_id, to_user_id)
);

create table invites (
  id                  uuid primary key default uuid_generate_v4(),
  circle_id           uuid not null references family_circles(id) on delete cascade,
  inviter_user_id     uuid not null references users(id),
  invitee_email       citext,
  invitee_phone       text,
  suggested_rel_from_inviter  text,
  suggested_rel_to_inviter    text,
  token               text not null unique,
  status              text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '30 days')
);

-- =========================================================
-- VISIBILITY
-- =========================================================
create table visibility_rules (
  id                  uuid primary key default uuid_generate_v4(),
  circle_id           uuid not null references family_circles(id) on delete cascade,
  scope               text not null check (scope in (
                        'only_me','specific_users','relationship_types',
                        'entire_circle','vault','future_release'
                      )),
  allowed_user_ids    uuid[] not null default '{}',
  allowed_relationship_types text[] not null default '{}',  -- e.g., {'child','grandchild'}
  created_by          uuid not null references users(id),
  created_at          timestamptz not null default now()
);

-- =========================================================
-- CONTENT (the polymorphic core)
-- =========================================================
create table memory_items (
  id                  uuid primary key default uuid_generate_v4(),
  circle_id           uuid not null references family_circles(id) on delete cascade,
  kind                text not null check (kind in (
                        'question','answer','post','comment',
                        'vault_message','imported_post','milestone'
                      )),
  author_user_id      uuid not null references users(id),
  body                text,                       -- main text content
  context_note        text,                       -- optional secondary note (e.g., on an imported post)
  related_question_id uuid references memory_items(id), -- when kind='answer'
  parent_memory_id    uuid references memory_items(id), -- when kind='comment' (threading)
  imported_source     jsonb,                      -- {platform, url, screenshot_media_id, author}
  visibility_rule_id  uuid not null references visibility_rules(id),
  meta                jsonb not null default '{}'::jsonb, -- kind-specific extras
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index on memory_items (circle_id, created_at desc);
create index on memory_items (author_user_id, created_at desc);
create index on memory_items (related_question_id);
create index on memory_items (parent_memory_id);
create index on memory_items (kind);

-- many recipients per question (or per direct post)
create table question_recipients (
  id                  uuid primary key default uuid_generate_v4(),
  question_memory_id  uuid not null references memory_items(id) on delete cascade,
  recipient_user_id   uuid not null references users(id),
  status              text not null default 'pending' check (status in ('pending','answered','dismissed','reminded')),
  answered_memory_id  uuid references memory_items(id),  -- the answer they gave
  created_at          timestamptz not null default now(),
  answered_at         timestamptz,
  unique (question_memory_id, recipient_user_id)
);

-- =========================================================
-- MEDIA
-- =========================================================
create table media_assets (
  id                  uuid primary key default uuid_generate_v4(),
  owner_user_id       uuid not null references users(id),
  circle_id           uuid not null references family_circles(id),
  kind                text not null check (kind in ('image','video','audio','document','screenshot')),
  storage_provider    text not null default 'supabase',  -- 'supabase'|'r2'|'stream'
  storage_path        text not null,
  mime_type           text,
  bytes               bigint,
  duration_seconds    numeric,
  width               int,
  height              int,
  hls_playlist_url    text,                       -- set when transcoded for streaming
  blurhash            text,
  created_at          timestamptz not null default now()
);

create table memory_media (   -- many media per memory item
  memory_id     uuid not null references memory_items(id) on delete cascade,
  media_id      uuid not null references media_assets(id) on delete cascade,
  position      int not null default 0,
  primary key (memory_id, media_id)
);

-- =========================================================
-- TIMELINES (placement, not duplication)
-- =========================================================
create table timelines (
  id            uuid primary key default uuid_generate_v4(),
  circle_id     uuid not null references family_circles(id) on delete cascade,
  kind          text not null check (kind in ('personal','relationship','family','topic')),
  owner_user_id uuid,                              -- when kind='personal'
  pair_user_ids uuid[],                            -- when kind='relationship' (length 2, sorted)
  topic_slug    text,                              -- when kind='topic' ('food','childhood','love',...)
  title         text not null,
  created_at    timestamptz not null default now(),
  unique (circle_id, kind, owner_user_id, pair_user_ids, topic_slug)
);

create table timeline_placements (
  id            uuid primary key default uuid_generate_v4(),
  timeline_id   uuid not null references timelines(id) on delete cascade,
  memory_id     uuid not null references memory_items(id) on delete cascade,
  placed_at     timestamptz not null default now(),
  placed_by     text not null check (placed_by in ('rule','ai_tag','user_pin','vault_release')),
  unique (timeline_id, memory_id)
);

create index on timeline_placements (timeline_id, placed_at desc);
create index on timeline_placements (memory_id);

-- =========================================================
-- VAULT
-- =========================================================
create table vault_items (
  id                  uuid primary key default uuid_generate_v4(),
  memory_id           uuid not null references memory_items(id) on delete cascade unique,
  creator_user_id     uuid not null references users(id),
  recipient_user_ids  uuid[] not null,
  release_rule        jsonb not null,
  -- examples:
  --   {"type":"on_date","date":"2040-03-14"}
  --   {"type":"on_birthday","user_id":"…","age":18}
  --   {"type":"on_milestone","user_id":"…","milestone":"first_child"}
  --   {"type":"after_death","verifier_user_ids":["…"]}
  --   {"type":"manual"}
  status              text not null default 'sealed' check (status in (
                        'sealed','scheduled','released','revoked','awaiting_verification'
                      )),
  released_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index on vault_items (status);

-- =========================================================
-- AI ARTIFACTS
-- =========================================================
create table transcriptions (
  id            uuid primary key default uuid_generate_v4(),
  media_id      uuid not null references media_assets(id) on delete cascade unique,
  language      text,
  text          text not null,
  segments      jsonb,           -- [{start,end,text}] for video playback sync
  engine        text not null,   -- 'whisper-1','deepgram-nova-3', etc
  created_at    timestamptz not null default now()
);

create table ai_tags (
  id            uuid primary key default uuid_generate_v4(),
  memory_id     uuid not null references memory_items(id) on delete cascade,
  topic_slug    text not null,   -- 'food','childhood','love',...
  confidence    numeric(3,2) not null,
  source        text not null check (source in ('ai','user')),
  created_at    timestamptz not null default now(),
  unique (memory_id, topic_slug, source)
);

create table embeddings (
  memory_id     uuid primary key references memory_items(id) on delete cascade,
  embedding     vector(1536) not null,
  model         text not null,
  updated_at    timestamptz not null default now()
);

create index on embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table prompt_suggestions (
  id                uuid primary key default uuid_generate_v4(),
  for_user_id       uuid not null references users(id),
  about_user_id     uuid not null references users(id),
  trigger_memory_id uuid references memory_items(id),
  text              text not null,
  status            text not null default 'pending' check (status in ('pending','used','dismissed')),
  created_at        timestamptz not null default now()
);

-- =========================================================
-- NOTIFICATIONS & DIGESTS
-- =========================================================
create table notifications (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id) on delete cascade,
  kind          text not null,   -- 'question_received','answer_received','vault_released','feed_post','digest_ready',...
  payload       jsonb not null,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index on notifications (user_id, created_at desc);

create table prompt_templates (   -- guided legacy prompts (Storyworth-style)
  id              uuid primary key default uuid_generate_v4(),
  category        text not null,
  body            text not null,
  suggested_for_relationships text[] not null default '{}',  -- {'parent','grandparent'}
  weight          int not null default 1
);

create table audit_log (
  id            uuid primary key default uuid_generate_v4(),
  actor_user_id uuid,
  circle_id     uuid,
  action        text not null,    -- 'invite.sent','member.removed','vault.released','export.requested',...
  target_kind   text,
  target_id     uuid,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);
```

### How a single answer fans out (worked example)

Linda records the Chicken in a Biskit video answer. Writes:

1. `media_assets` — one row for the video, status = uploaded.
2. `memory_items` — one row, kind=`answer`, author=Linda, related_question_id=Aaron's question, visibility_rule_id=R (just-Aaron-and-Linda).
3. `memory_media` — one row linking the memory to the media.
4. `question_recipients` — update row, status=`answered`, answered_memory_id=this.
5. **No duplication.** Then placements:
6. `timeline_placements` — row into Linda's personal timeline (auto by trigger on insert of any memory by Linda where visibility ≠ only-her-private).
7. `timeline_placements` — row into Aaron↔Linda relationship timeline (auto when visibility includes both).
8. `timeline_placements` — row into Family timeline (only if visibility = entire_circle; in this example, skipped).
9. Async jobs fire:
   - `transcriptions` row written by Whisper worker.
   - `ai_tags` row written by tagging worker (`food`, 0.92). On insert, a trigger adds a `timeline_placements` row into the `topic:food` timeline.
   - `embeddings` row upserted from the transcript + body.
   - `prompt_suggestions` row created for Aaron: "Ask Mom what other after-school snacks she had."
10. `notifications` row for Aaron: `kind='answer_received'`.

The video lives in **one** `media_assets` row. It appears in **four** timelines via four `timeline_placements`. Deleting the memory cascades cleanly via `on delete cascade`.

### Helpful views

```sql
-- The unified feed query for a given user in a given circle, RLS-aware
create view v_user_feed as
select
  m.*,
  tp.timeline_id,
  tp.placed_at
from memory_items m
join timeline_placements tp on tp.memory_id = m.id
where m.deleted_at is null
order by tp.placed_at desc;
```

(RLS policies on `memory_items` ensure each user only sees rows their `visibility_rule_id` allows.)

---

## I. Privacy & Permissions Model

### Trust thesis

This app holds the most emotionally valuable content a family will ever produce. Trust is the product. A single privacy leak resets the company.

### Layered model

1. **Identity** — strong sign-in (Apple/email/phone), per-device tokens, biometric app lock on iOS.
2. **Authorization** — every read/write is enforced by Postgres Row-Level Security; the client cannot bypass.
3. **Storage** — media is private by default; access is via short-lived signed URLs minted only after an RLS-passing query.
4. **Crypto** — at rest on disk (Postgres + S3-class storage encryption). TLS 1.3 in transit. Vault items get a per-item content key, wrapped with the family's KMS key (Phase 2; AES-256 envelope encryption).
5. **Account-level controls** — biometric lock, recovery via verified backup channel, no SSO into third parties without explicit opt-in.
6. **Family-level controls** — admin can remove a member; on removal, that user's _future_ read access stops immediately; their _past_ contributions remain (configurable per family).
7. **AI controls** — opt-in per family for AI features; opt-out at any time; AI requests never log content beyond what is necessary; no third-party AI is given persistent access to media.
8. **Audit** — every membership change, vault state change, export, and deletion is in `audit_log`. Visible to admins.

### Row-level security policy sketches

These are simplified for illustration. Production policies should be split for `select`, `insert`, `update`, `delete`.

```sql
-- A user can see a memory if:
--   they are the author, OR
--   they are in the same circle AND the visibility rule allows them
create policy memory_select on memory_items
for select using (
  auth.uid() = author_user_id
  or exists (
    select 1
    from family_memberships fm
    where fm.user_id = auth.uid()
      and fm.circle_id = memory_items.circle_id
      and fm.removed_at is null
  )
  and visibility_allows(auth.uid(), visibility_rule_id, circle_id, author_user_id)
);

-- helper function
create function visibility_allows(
  viewer_id uuid, rule_id uuid, circle_id uuid, author_id uuid
) returns boolean language sql stable as $$
  select case
    when v.scope = 'entire_circle' then true
    when v.scope = 'only_me' then viewer_id = author_id
    when v.scope = 'specific_users' then viewer_id = any(v.allowed_user_ids) or viewer_id = author_id
    when v.scope = 'relationship_types' then exists (
      select 1 from relationships r
      where r.circle_id = circle_id
        and r.from_user_id = author_id
        and r.to_user_id = viewer_id
        and r.relationship_type = any(v.allowed_relationship_types)
    ) or viewer_id = author_id
    when v.scope = 'vault' then viewer_id = author_id     -- only creator sees until release
    when v.scope = 'future_release' then false            -- locked
    else false
  end
  from visibility_rules v
  where v.id = rule_id;
$$;
```

A parallel policy gates `media_assets` reads (must be referenced from a `memory_items` row the user can see, OR the user is the owner).

### Vault release

A `pg_cron` job runs every 15 minutes. For each `vault_items` row in status `scheduled` whose `release_rule` is due, an Edge Function:

1. Atomically updates `vault_items.status = 'released'` and `released_at = now()`.
2. Mutates the linked `memory_items.visibility_rule_id` to the post-release rule (creating a new rule sourced from the recipients).
3. Inserts `timeline_placements` for each recipient's personal timeline and the relationship timeline.
4. Sends push notifications to recipients with a deliberately gentle copy: _"A message from Mom is now ready for you."_
5. Writes to `audit_log`.

### Membership removal

When an admin removes a member:

- `family_memberships.removed_at = now()` (soft delete).
- RLS policy stops returning circle content to that user immediately.
- Their authored content stays in the circle (configurable). For each authored memory, on removal, run a job that re-evaluates whether the original visibility rule should narrow (e.g., "everyone in family" might be downgraded to "remaining members only"). Default: leave as-is.
- That user's vault items targeted at the family are preserved unless the user themselves revokes them.

### Handling minors

- Under-13 (or your jurisdiction's threshold) users cannot create an account directly. A parent admin creates a **co_pilot** profile linked to the parent's account; the child gets read access through the parent only, and can author content only when the parent is present (UI affordance).
- On reaching the threshold, a one-time handoff flow converts the co_pilot profile into a standalone user with full ownership of all authored content.

### Handling deceased users / legacy contacts

- Each user can name one or more **legacy contacts** (default: an admin in their circle).
- On death notification, a legacy contact submits proof (death certificate upload + verifier sign-off). Account enters **legacy mode**:
  - No new authoring.
  - Vault items with `after_death` release rule are evaluated and released.
  - Profile and timeline persist for the family.
- Builds toward Phase 3 "inheritance protocol" where account ownership can transfer to a successor.

### Consent

- Before any media is uploaded, the recording surface shows a small, persistent consent reminder.
- When a user posts content involving someone else (tagged photos, recorded calls in Phase 3), the tagged person gets a notification and the option to request takedown.
- AI features are opt-in at the family level. Opt-out triggers a job that deletes derived AI artifacts (transcriptions, tags, embeddings) for that family within 7 days.

### Data export and deletion

- Per-user export (in Settings → Privacy): generates a zip of all media + a JSON dump of all `memory_items` authored by the user and all timelines they're part of. Emailed as a signed link expiring in 7 days.
- Account deletion: 30-day soft delete with restore; then hard delete cascades. Content the user authored is purged from the family by default; family admins can opt to retain "with author shown as Removed Member" before purge happens.
- Family deletion: requires unanimous admin agreement and 14-day cooldown.

### Sharing outside the circle

- No public sharing in v1.
- "Send a memory to someone" outside the app generates a **time-limited, view-only, signed link** with a watermark. Tracked in `audit_log`. Default expiry 7 days.

### Threat model & explicit non-goals

- We protect against: opportunistic access by other family members, lost-device access, casual mass-leak, AI vendor misuse, post-removal data peeping.
- We do not protect against: a determined nation-state attacker, a court order, a family member sharing screenshots out of band (we educate; we cannot prevent).
- Vault is private but not unbreakable: a server-side compromise of the KMS root key would expose vaults. Document this honestly in Trust Center copy.

---

## J. AI Feature Architecture

### Principles

1. **AI is the librarian, not the author.** It organizes and surfaces; it does not invent memories.
2. **Per-family opt-in.** Default ON for new families with a clear explanation; admins can turn it off and erase derived artifacts.
3. **Content boundary.** AI sees only content the requesting user already has permission to see (we pass the user's RLS context to all internal AI calls). Never send a third-party AI more than the minimum.
4. **Provenance shown.** Every AI-generated chapter title, tag, or summary is visibly labeled as AI and is editable in one tap.
5. **No training on family data.** All vendor calls use APIs that contractually disallow training (OpenAI/Anthropic enterprise terms; Deepgram opt-out).

### Pipelines

#### J.1 Transcription pipeline

Trigger: `INSERT` on `media_assets` where `kind in ('audio','video')`.

1. Edge Function `transcribe_media` is enqueued.
2. Function fetches the media (signed URL), submits to Whisper/Deepgram with language hint from profile.
3. On response, writes `transcriptions` row with `segments` (for playback sync) and the full `text`.
4. Triggers downstream: tagging + embedding.

SLA: target end-to-end transcription latency P50 < 60s for a 3-min clip.

Failure handling: retry 3× with exponential backoff; on persistent failure, store an error tag and surface a "Retry transcription" affordance to the author.

#### J.2 Topic tagging

Trigger: `INSERT` on `memory_items` for kinds `answer`, `post`, `vault_message`, `imported_post`. Wait for transcription if media is present.

Process:

1. Compose a Claude Haiku call with: the question body (if any) + the answer text + the transcript + the importer note + the existing tag taxonomy.
2. Prompt asks for up to 3 topic tags from a fixed taxonomy + a confidence score per tag.
3. Write rows to `ai_tags` with `source='ai'`.
4. Trigger: for each topic tag above threshold (e.g., 0.6), insert into `timeline_placements` for the topic timeline.
5. The user can edit tags (a `source='user'` row supersedes the AI row in any UI grouping logic).

Tag taxonomy (MVP):
`childhood, food, love, advice, faith, holidays, funny_stories, lessons, travel, music, work, parenting, school, family_traditions, milestones, photos_old, photos_new, recipes`

#### J.3 Follow-up question suggestions

Trigger: on insert of `answer`.

Process:

1. Fetch the question + answer + last N memories in the same relationship timeline.
2. Claude Sonnet call with a prompt that emphasizes: warm, specific, not generic, ≤ 14 words, no clichés.
3. Save up to 3 candidates to `prompt_suggestions` for the original asker.
4. Surface in the asker's "Ask" screen as gentle suggestions, never auto-send.

Example output for the Chicken in a Biskit answer:

- "What was the first snack you bought with your own money?"
- "Did you ever pack lunch for school? What was in it?"
- "Is there a snack you wish I'd grown up with?"

#### J.4 Search

Hybrid:

1. Query gets a Postgres FTS search across `memory_items.body`, `memory_items.context_note`, and joined `transcriptions.text`.
2. Same query gets an embedding (OpenAI/Voyage) and a `vector` cosine search against `embeddings`.
3. Results merged with a tunable weighted score; deduped by `memory_id`.
4. RLS-filtered automatically (queries run under the user's auth context).

#### J.5 Chapter & relationship summaries (Phase 2)

Run nightly per active timeline:

1. Take the last 30 days of placements.
2. Generate (a) a chapter title for the period and (b) a 2–3 sentence summary, both labeled AI and editable.
3. Cache in a `timeline_summaries` table (added in Phase 2).

#### J.6 Book export (Phase 2)

For a chosen scope (personal | relationship | family):

1. Pull all relevant memories with placements.
2. Outline → chapters by topic and time period.
3. For each memory, prefer the user-written body; for media-only memories, use the transcript with a light cleanup pass.
4. Insert media via paginated layouts (one full-page photo per spread or inline).
5. Render to PDF (server-side via a small worker, e.g., Puppeteer or `react-pdf`).
6. The user reviews and can re-order, hide entries, or edit AI-written transitions before checkout for print.

### Cost & latency model (rough, MVP scale)

Assume 100 active families × 4 members × 6 voice/video answers per week of avg 90s each:

- ~2,400 transcriptions/week × 90s = 60h/week of audio
- Whisper-class: ~$0.006/min → ~$22/week
- Tagging (Haiku): 2,400 calls × ~$0.0006 → ~$1.50/week
- Embeddings: 2,400 × ~$0.00002 → trivial
- Follow-ups (Sonnet, only on direct answers): 2,400 × ~$0.01 → ~$24/week

Total AI cost at 100 families ≈ **~$50/week, i.e., ~$0.50/family/month**. Negligible relative to subscription pricing.

### Privacy & telemetry on AI

- Every AI call is logged as an event (`ai_request`) with: model, latency, token counts, the **hash** of the input (not the input), and the family id.
- Users see in Settings → Privacy a counter: "We've made N AI calls on your behalf this month; here's what for."
- Opt-out: a single switch that flips the family's `ai_enabled` flag and enqueues a deletion job for transcriptions, tags, embeddings, prompt_suggestions, and summaries owned by that family. Job target: complete within 7 days.

---

## K. UI/UX Design Guide

### Design pillars

1. **Warm, premium, quiet.** White paper, rose ink, soft shadows. Feels like a Moleskine, not a TikTok.
2. **One primary action per screen.** Linda must always know what to tap.
3. **The recording surface is the hero.** It should feel calm. No jittery animations on Mic / Camera.
4. **Mom-readable defaults.** 17 pt body type minimum, 1.5× spacing, hit targets ≥ 48 pt.
5. **Privacy is visible.** Every piece of content shows a visibility chip. No surprises.

### Color tokens

```
color.bg.primary           #FFFFFF
color.bg.secondary         #FFFBFA   (warm off-white)
color.bg.tinted            #FFF1F3   (blush surfaces, cards on cards)
color.bg.vault             #2A1820   (deep wine — only inside vault context)
color.accent.primary       #C0345C   (dark rose — primary buttons, links)
color.accent.primaryPress  #9B294A
color.accent.secondary     #F2A9BC   (blush — chips, highlights)
color.accent.gold          #C09155   (vault accent, rare)
color.text.primary         #1A1418
color.text.secondary       #5C545A
color.text.muted           #908990
color.text.onAccent        #FFFFFF
color.border.subtle        #F1E7EA
color.border.strong        #DCD0D4
color.success              #2E8B57
color.warning              #B9701D
color.danger               #B23A48
```

Dark mode: invert backgrounds to warm dark grays (#15101A series); keep rose accents identical. Vault context stays dark in both modes.

### Typography

Family: **SF Pro Display** for headings, **SF Pro Text** for body (system default on iOS). Tabular figures for timestamps and counts.

```
type.display.xl   34/40, weight 700  — onboarding hero
type.display.lg   28/34, weight 700  — screen titles
type.title.md     22/28, weight 600  — card titles
type.body.lg      17/24, weight 400  — primary body (Linda-friendly)
type.body.md      15/22, weight 400
type.caption      13/18, weight 500  — chips, captions
type.mono         15/22, weight 500  — timestamps if mono is wanted
```

User-controlled scale via `profiles.text_size_scale`: 0.9, 1.0, 1.15, 1.3, 1.5.

### Spacing & radius

```
space.1 = 4
space.2 = 8
space.3 = 12
space.4 = 16   (base)
space.5 = 20
space.6 = 24
space.8 = 32
space.10 = 40
space.12 = 48
radius.sm = 8
radius.md = 14
radius.lg = 20   (cards)
radius.xl = 28   (sheets)
radius.pill = 999
```

### Elevation & shadows

```
shadow.sm   0 1 2 rgba(26,20,24,0.04)
shadow.md   0 4 12 rgba(26,20,24,0.06)
shadow.lg   0 8 24 rgba(26,20,24,0.08)
shadow.vault 0 8 32 rgba(0,0,0,0.4)   (only on vault surfaces)
```

### Motion

- Use **Reanimated 3 spring** with `damping 18, stiffness 220` for taps and screen transitions.
- Recording mic pulse: 2 s sine, ±2% scale; never jarring.
- Sheet entry: 240 ms spring; exit 180 ms ease-out.
- Reduced motion respected: cross-fade instead of slide.

### Components (canonical specs)

- **Button (primary)**: rose fill, white label, radius.pill, height 52, type.body.lg/600, full-width by default, haptic medium impact on press.
- **Button (secondary)**: tinted bg, rose label, same shape; for non-destructive secondary actions.
- **Card**: bg.primary on bg.secondary, radius.lg, padding space.5, shadow.md, optional avatar header + body + actions bar.
- **VisibilityChip**: rounded pill, icon + label, two tones — neutral (`Just us`, `Family`), gold (`Vault`).
- **Avatar**: 40 / 56 / 96 px sizes, optional rose ring for "unread."
- **BottomSheet**: radius.xl top corners, drag handle, grouped lists inside.
- **RecordingControl**: black-tinted full-screen surface, single primary button (mic or camera), big timer, waveform, "Cancel" / "Send" buttons after stop.
- **TimelineCard**: same as Card with extra timestamp row + topic chip; tap expands media inline.
- **PromptCard**: rose-tinted bg, italic body, "Use this prompt" button.

### Empty states

Every empty state must include: a soft illustration (no people, just objects — a paper, a record, a teacup), a one-line emotional explainer, and one primary action. Examples:

- Empty Home: "Your family hasn't started yet. Ask the first question." → Ask
- Empty Vault: "Leave a message for the future." → New Vault Item
- Empty Inbox: "No questions yet. Want to ask Mom something?" → Ask Mom

### Accessibility

- WCAG AA on all text (rose-on-white passes for body weight ≥ 400 at 15 pt+).
- VoiceOver labels on every interactive element; meaningful order.
- Dynamic Type fully supported.
- Captions automatically attached to all video playback once transcribed.
- One-handed reachability: primary actions in the bottom third of the screen.

### Notification copy guidelines

Always emotional, never urgent. Examples (good):

- "Aaron asked you a memory question."
- "A message from Mom is now ready for you."
- "This week your family added 4 new memories. Take a look."

Never (bad):

- "You have 3 unread messages."
- "Don't miss out — answer now!"

### Onboarding tone

Use sentences, not feature bullets. Sample copy:

- Screen 1: "Welcome. This is a quiet place for your family." (Tagline: "Ask anything. Save every answer.")
- Screen 2: "We'll keep everything between the people you choose."
- Screen 3: "Add your family. The app feels different once they're here."
- Screen 4: "Start with one small question."

---

## L. Monetization Plan

### Posture

- This is a family product paid by one person (the Initiator) on behalf of many users (the Family).
- Free tier exists to let elders try without friction; paid tier is for the household.
- Pricing is _family-based_, not per seat. Charging per grandparent kills adoption.

### Tiers

**Free — "Try It"**

- 1 family circle
- Up to 6 members
- Text-only questions and answers, unlimited
- Up to **10 voice/video answers per month total per family**
- Up to **1 GB storage**
- Personal + family timeline (no relationship timelines, no topic timelines)
- No Vault
- No AI features
- Designed to demonstrate value; not designed to last forever.

**Family — $14.99/month or $129/year**

- Up to 12 members
- Unlimited voice and video answers (3-min cap per item)
- 100 GB storage
- All timelines (personal, relationship, family, topic)
- Vault: date / birthday / age / manual triggers
- AI: transcription, tagging, follow-up suggestions, search
- Weekly digest
- Standard export (JSON + media zip)

**Legacy — $29.99/month or $249/year**

- Up to 25 members
- 1 TB storage
- All Family features, plus:
- Longer videos (10 min)
- Advanced vault: milestone triggers, death-triggered release with verifiers
- AI book/PDF export (4 included per year, more à la carte)
- Multiple circles (chosen family, in-laws)
- Priority transcription
- White-glove onboarding for elders (Phase 3)

**Lifetime — $999 one-time (limited; Phase 3)**

- Legacy features forever for one family
- Includes a hardcover annual book each year for 5 years
- Sold sparingly as a serious commitment product

### One-time products (margin engine)

- Hardcover **"Story of Mom"** book: $79 + shipping
- Hardcover **"Story of Mom & Aaron"** relationship book: $89 + shipping
- Audio memoir (curated, mastered): $129 digital, +$49 for USB keepsake
- Framed timeline poster: $49

### Pricing logic

- Anchor on Storyworth ($99/year for 1 book/year) and iCloud Family (storage utility). We're more than Storyworth and more than storage, so $129/year is the floor.
- Legacy tier exists for households serious about long-term preservation; the price difference funds vault verification, larger storage, and white-glove onboarding.
- Annual is the default presentation (best price); monthly is offered for trial converters.

### Conversion strategy

- 30-day full Family-tier trial at signup; no card up front.
- Trigger paywall at the **emotional moment**: first time a third family member joins, OR first time a voice answer is recorded, OR when AI surfaces the first topic timeline. Never paywall the Ask flow itself.
- "Gift Kin to your parents" — Aaron can gift a Family-tier year as a one-tap purchase from his account. Aimed at Mother's Day / Father's Day / holidays.
- Annual reminder email 30 days before renewal with a "Year in your family" recap.

### Unit economics (illustrative)

- Family tier ARPU: ~$130/year.
- Storage cost at 100 GB avg utilization with R2 = ~$1.50/family/year.
- AI cost: ~$6/family/year (from section J).
- Payment + infra + support ≈ $10/family/year.
- Gross margin ≈ 86% on Family tier; print products are accretive at ~40% margin.

### Anti-patterns we will not do

- No ads. Ever.
- No selling or licensing family data. Ever.
- No "free with watermark" exports.
- No dark-pattern cancellation flow.

---

## M. Roadmap (12–18 months)

### Quarter view

**Q1 (months 1–3)** — Foundations + MVP build

- Hire: 1 founding designer, 2 full-stack engineers (RN + Supabase), 1 part-time iOS specialist for recording surfaces.
- Build: auth, circle, profiles, relationships, Ask, Answer (text/voice/video), feed, basic timelines, basic Vault, transcription, tagging, search, notifications, weekly digest.
- Closed alpha with ~15 families (founder network).

**Q2 (months 4–6)** — Launch MVP + early polish

- Public beta on App Store with paywall.
- Onboarding tuning for elders (the make-or-break work).
- Push notification copy A/B.
- Topic timelines refined; first AI book sketch.
- Add iOS Share Extension for social import.
- Sales push: gift flow for Mother's Day.

**Q3 (months 7–9)** — Depth

- Video memory replies on imported posts.
- Advanced Vault: milestone & death-triggered releases (with named verifiers).
- AI book export v1.
- Polls in the feed.
- Begin Android client (1 engineer).

**Q4 (months 10–12)** — Compounding

- AI chat trained on your family memories ("Ask the archive").
- Annual recap auto-generated and gifted to families.
- Hardcover book product live with a print partner.
- Family tree visualization.

**Year 2 (months 13–18)** — Long-tail

- Web read-only access.
- Multiple circles per user.
- Voice cloning for narration (opt-in, watermarked).
- Inheritance/handoff protocol.
- Localization: Spanish (Mexico) first.
- Therapist / hospice partnerships pilot.

### Milestones to gate the next quarter

- End Q2: 1,000 paying families, M3 retention ≥ 50%.
- End Q3: 5,000 paying families, NPS ≥ 55, ≥ 60% of families have ≥ 1 vault item.
- End Q4: 15,000 paying families, book product attach rate ≥ 6%, churn < 4%/mo.

### Deliberate non-roadmap items

- No browser-first product in year 1.
- No public sharing in year 1.
- No "Kin for Work" / B2B side-quest in year 1.
- No NFTs, no on-chain anything.

---

## N. Build Plan — Small Batches

Each batch is sized for ~3–5 working days for a small team. Don't move on until acceptance criteria pass. Order is important; do not parallelize beyond what's noted.

### Batch 0 — Repo, infra, tooling (3 days)

- Monorepo with pnpm workspaces: `apps/mobile`, `packages/db`, `packages/ui`, `packages/shared`.
- Expo SDK 51+ with TypeScript strict.
- Supabase project (dev/staging/prod), local Supabase via Docker.
- Migrations: `packages/db/migrations/*.sql`, applied via `supabase migration up`.
- ESLint + Prettier + tsc check + Vitest.
- EAS Build profile for internal distribution (TestFlight).
- Acceptance: a developer runs `pnpm i && pnpm dev` and gets a hello-world Expo app talking to local Supabase.

### Batch 1 — Auth & profile (4 days)

- Apple Sign-In + email magic link + SMS phone.
- `users`, `profiles` tables + RLS.
- Onboarding screens: welcome → sign in → profile (name, photo, birth year, tagline).
- Acceptance: a brand-new user can sign in, create a profile, see a Home tab placeholder, and sign out.

### Batch 2 — Family circle + invites + relationships (5 days)

- `family_circles`, `family_memberships`, `relationships`, `invites` + RLS.
- Create-circle flow.
- Invite flow (SMS via Twilio + universal link).
- Accept-invite flow with relationship suggestion.
- Family tab listing members with relationship labels.
- Acceptance: Aaron creates a circle, invites Linda, Linda accepts the SMS link, both see each other in Family with confirmed relationships.

### Batch 3 — Visibility rules + Ask flow (text only) (5 days)

- `visibility_rules` + RLS helper function.
- `memory_items` + `question_recipients` + RLS.
- `timelines` + `timeline_placements` (with trigger that auto-places authored memories into the author's personal timeline and the relationship timeline of single-recipient questions).
- Ask screen: recipient picker → text composer → visibility chip → send.
- Inbox screen: list of pending questions for the user.
- Acceptance: Aaron asks Linda a text question; Linda sees it in her inbox with correct visibility; both see the question in their personal and relationship timelines.

### Batch 4 — Answer flow (text) + relationship timeline view (4 days)

- Answer composer (text).
- Update `question_recipients.status='answered'`.
- Trigger places the answer into the asker's relationship timeline + responder's personal timeline.
- Relationship timeline screen: tap a family member, see all memories between you and them.
- Acceptance: Linda answers Aaron's question with text; Aaron sees the answer in his inbox + relationship timeline; the question is marked answered.

### Batch 5 — Media: voice & video recording, upload, playback (6 days)

- `media_assets` + `memory_media` + RLS.
- Supabase Storage bucket with RLS-aware signed URLs.
- iOS audio recording surface (native module wrap if needed).
- iOS video recording surface using `react-native-vision-camera`.
- Background upload with offline queue (MMKV + SQLite outbox).
- Inline playback in cards with waveform / video player.
- Acceptance: Linda records a 90-second video answer, sees it upload reliably from a flaky network, and Aaron plays it inline.

### Batch 6 — Family feed + posts (4 days)

- Post composer (photo + text, video later optional).
- `memory_items.kind='post'` placement into Family timeline (if visibility allows).
- Home tab: vertical feed query, infinite scroll.
- Reactions (single emoji set) + text comments.
- Acceptance: Aaron posts a throwback photo; everyone in family sees it; Mike taps to react; Linda comments.

### Batch 7 — Transcription pipeline + topic tagging (5 days)

- Edge Function `transcribe_media` (Whisper or Deepgram).
- `transcriptions` table.
- Edge Function `tag_memory` (Claude Haiku).
- `ai_tags` table; trigger places into topic timeline.
- Captions visible in video player.
- Topic timelines visible on Timeline tab.
- Acceptance: every new voice/video answer gets a transcript within 60s P50; tags appear on items; "Food" topic timeline shows the Chicken in a Biskit answer.

### Batch 8 — Search (4 days)

- `tsvector` columns on `memory_items.body`, with trigger to keep updated.
- `embeddings` table; embedding worker on insert.
- Search screen with hybrid query.
- Acceptance: searching "chicken biskit" finds the answer; semantic search "what did mom eat as a kid" also surfaces it.

### Batch 9 — Vault (5 days)

- `vault_items` + RLS (only creator sees pre-release).
- New-vault flow (record + recipients + release rule + preview).
- `pg_cron` job + Edge Function for releases due.
- Notification on release.
- Vault tab UI.
- Acceptance: Linda records a vault video set to release in 10 minutes; the cron releases it; Aaron gets push and sees it in his timeline.

### Batch 10 — Notifications + weekly digest + telemetry (4 days)

- Expo Push integration with permission flow.
- Push triggers for: question received, answer received, vault released, feed post by a family member.
- Weekly digest job: per-user email + in-app card with the week's memories.
- PostHog events (no content), Sentry errors.
- Acceptance: real pushes arrive on a real device; weekly digest fires reliably for a test account.

### Batch 11 — Settings, export, deletion (4 days)

- Settings screens.
- Export job: zip of media + JSON dump emailed via signed link.
- Account delete (30-day soft delete with restore).
- Member removal flow for admins.
- Acceptance: a user can export their data; an admin can remove a member; a deleted account fully purges after 30 days.

### Batch 12 — Polish & elders UX pass (5 days)

- Text size scale wiring through Tamagui tokens.
- Reduce-motion respected.
- VoiceOver pass on every primary surface.
- Empty states reviewed and warmed up.
- All notification copy reviewed against the tone guide.
- Acceptance: a 70-year-old non-tester can complete an Answer in voice from scratch with no help.

### Batch 13 — Closed alpha (continuous)

- TestFlight with 15 friendly families.
- Weekly cadence: ship → measure → call families.
- Tracking: activation, weekly-active families, recordings per family per week, NPS.

### Batch 14 — Beta launch (App Store)

- Paywall integration (RevenueCat for subscription management).
- App Store assets, privacy policy, Trust Center page.
- Crash-free rate ≥ 99.5% gate before public beta.

---

## O. Risks & Hard Problems

Honest list. Each item names the risk, why it's hard, and the mitigation.

### O.1 Elder activation

**Risk:** Linda and Grace never adopt. Aaron churns.

**Why hard:** Notification permission, sign-in, recording permission, and one successful answer all have to succeed on day 1, often in a setting where Aaron is showing his mom the app, not where Linda is exploring it solo.

**Mitigations:**

- Co-pilot mode for elders during onboarding (Aaron literally drives Linda's first answer on her phone).
- Answer-via-link fallback: if Linda can't get the app working, the asker can text her a one-tap link that opens a minimal browser page where she records her answer (Phase 2).
- Real-world user research with elders weekly, recorded sessions, optimize ruthlessly for first-answer completion.

### O.2 Privacy incident

**Risk:** any leak of family data is existential.

**Why hard:** complex visibility rules, RLS bugs can be silent, signed URLs can be misused, AI vendors can leak.

**Mitigations:**

- RLS-first architecture; never filter in app code.
- Property-based tests for visibility (generate random combinations of authors, viewers, rules, and assert allowed/denied).
- Quarterly external pentest.
- Trust Center page with plain-English security commitments.
- Vault uses envelope encryption with a per-family wrapping key; loss of one family does not leak others.

### O.3 Media costs

**Risk:** video is expensive; storage and egress can outpace revenue.

**Why hard:** A vault of high-bitrate videos for a family of 10 over 20 years is non-trivial.

**Mitigations:**

- Transcode to HLS with sane bitrate ladders.
- Migrate large objects to Cloudflare R2 + Stream when egress > 5 TB/mo (zero egress fees from R2).
- Per-family storage caps with overage purchase.
- Long-tail "cold" media moved to glacier-class storage with rehydrate-on-access UX.

### O.4 Death-triggered release

**Risk:** false positives (releasing a vault while a user is alive) or false negatives (never releasing).

**Why hard:** there is no clean signal for death; humans must be involved.

**Mitigations:**

- Phase 2 only. Require 2 named verifiers + a death certificate upload reviewed by ops.
- Mandatory 14-day cooling-off period before any after-death release fires.
- Annual "are you still you?" check-in for users with after-death vault items pending, with an explicit "I'm here" confirmation that resets the verification clock.

### O.5 Multi-recipient questions and divergent answers

**Risk:** Aaron asks Mom _and_ Dad the same question; the data model has to keep answers separate per recipient while linking them logically.

**Mitigation:** `question_recipients` is the source of truth for the per-recipient state; each answer is its own `memory_items` row with `related_question_id` pointing back. Relationship timelines pull only the answer relevant to that pair.

### O.6 Asymmetric relationship truth

**Risk:** Aaron declares Linda is "my mom"; Linda has not yet confirmed. UI must show this gracefully.

**Mitigation:** `relationships.confirmed_by_to`. Until confirmation, show "Aaron's mom (pending)". Bi-directional confirmation gives a stronger trust signal for future features (e.g., legacy contacts).

### O.7 Family conflict

**Risk:** divorce, estrangement, abuse. The app holds intimate content that can become weaponized.

**Mitigations:**

- Robust admin transfer + circle exit with content rights honored (each member can take their own contributions; family decides whether others' visible content stays accessible to a leaver).
- Blocked members can't see new content from blockers (in-circle blocks).
- Clear deletion paths for content involving a removed/blocked member.
- Trust & Safety review process for reports.

### O.8 Minors authoring content

**Risk:** legal exposure (COPPA, GDPR-K), and the responsibility of preserving content created by a child who will become an adult.

**Mitigation:** co_pilot accounts under 13, single-tap handoff at majority, conservative defaults, explicit parental consent flow.

### O.9 AI hallucination

**Risk:** AI invents chapter titles, summaries, or follow-ups that misrepresent the family.

**Mitigations:**

- Anything user-facing is one-tap editable.
- Summaries shown alongside source memories, not in place of them.
- A "Show me the source" affordance on every AI artifact.
- Never let AI re-write a user's actual words; it can summarize _around_ them, not over them.

### O.10 Long-term data durability

**Risk:** the app or company disappears. The family loses everything.

**Mitigations:**

- First-class export (zip + JSON) always available, no paywall.
- A documented data schema published in the Trust Center.
- A clear plan: if the company shuts down, customers get 12 months of read-only access and free export.
- Optional self-hostable export bundle in Phase 3 (Postgres dump + static viewer).

### O.11 iOS App Store policy

**Risk:** Apple rejects for reasons related to user-generated content, age rating, or subscription terms.

**Mitigations:**

- Content reporting + blocking + moderation policy in place at launch.
- Age 17+ rating (UGC).
- Subscription terms presented exactly per App Store guidelines (App Store-only billing for app subscriptions; physical products via web checkout to avoid 30% on print).

### O.12 Founder bus factor

**Risk:** small team, lots of context.

**Mitigations:** spec like this one is the antidote. Keep it current. Treat the schema as a contract. Document every visibility decision in the audit log copy.

---

## P. v1 Build Prompt for a Coding Agent

> Copy everything below the line into a coding agent (e.g., Claude Code, Cursor, etc.). The agent should treat this as the operating spec for a multi-week build.

---

You are a senior full-stack engineer pair-programming the v1 build of **Kin**, a private family memory app. You will work in small batches and ship.

### Mission

Build the MVP defined below. Optimize for: (1) emotional polish in the recording and answer flows, (2) correctness of the privacy/visibility model, (3) speed of iteration. When in doubt, prefer fewer features done beautifully.

### Stack (non-negotiable for v1)

- **Mobile**: React Native via Expo (managed workflow, EAS Build) + TypeScript strict mode. Tamagui for UI. Reanimated 3 for animation. `react-native-vision-camera` for video, native `AVAudioRecorder` bridge for audio. TanStack Query + Zustand for state. MMKV + Expo SQLite for the offline outbox.
- **Backend**: Supabase. Postgres with extensions `uuid-ossp`, `pgcrypto`, `vector`, `pg_trgm`, `pg_cron`. Auth (Apple, email magic link, phone via Twilio). Storage. Edge Functions (Deno). Realtime for feed updates.
- **AI**: Whisper or Deepgram for transcription, Anthropic Claude Haiku for tagging + suggestions, Claude Sonnet for summaries (Phase 2), OpenAI `text-embedding-3-large` for embeddings stored in pgvector.
- **Push**: Expo Push.
- **Payments**: RevenueCat (Phase 1.5 — not v1).
- **Telemetry**: PostHog (no-content events), Sentry.

### Repo layout

```
/apps/mobile             — Expo app
/packages/db             — SQL migrations + seed data
/packages/ui             — Shared Tamagui components
/packages/shared         — Types, schemas (zod), util
/supabase/functions      — Edge Functions
/supabase/policies       — RLS policies in versioned SQL
```

### Source of truth

Use the schema in section H. Use the visibility model in section I. Use the design tokens and component specs in section K. Do not invent fields or routes that aren't in this spec; if you need one, propose it before adding.

### Build order

Implement batches 0–12 from section N in order. Do not move on until acceptance criteria pass. Treat each batch as a PR (or set of PRs) with:

- Migrations (forward + down)
- RLS policies + property tests
- UI screens
- One playable demo (TestFlight build or screen recording)

### Engineering rules

1. **Never bypass RLS in app code.** All reads/writes use the user's session token. Service-role keys are used only in Edge Functions for system tasks.
2. **Outbox-first for sending.** The Ask, Answer, and Post flows write to a local outbox immediately and reconcile to the server. No destructive UI on network errors.
3. **All media uploads are resumable** and survive app backgrounding. Show progress.
4. **One primary action per screen.** Push back on any design that violates this.
5. **No content in telemetry.** Log shapes, counts, durations, hashes — never bodies.
6. **TypeScript strict.** No `any`. Generate Supabase types via `supabase gen types typescript`.
7. **Use the design tokens.** No hardcoded colors, spacing, or radii.
8. **Test the visibility matrix.** A property test must generate random (author, viewer, rule) triples and assert RLS results match the spec.

### Definitions of done for v1

- A new user can sign in, create a family circle, invite at least one other member, ask a text + voice + video question, and see the answer appear in three places (personal, relationship, family) with the correct visibility.
- An elder-friendly UX pass is complete: a tester aged 65+ can complete the Answer flow in voice with no instruction.
- Transcription, tagging, search, and notifications all work end-to-end with realistic latencies.
- Vault can release on date, birthday, or age; the release is reliable to within 15 minutes.
- A user can export all their data and fully delete their account.
- Crash-free sessions ≥ 99.5%. Cold start < 1.8s on iPhone 13. Answer→playback round trip < 3s on Wi-Fi for a 60s voice clip.

### What to NOT build in v1

- No social media API integrations (Share Extension only).
- No book export.
- No family tree visualization.
- No multi-circle support.
- No web app.
- No death-triggered vault release.
- No AI chat.

### Communication

After each batch:

- Write a `BATCH-N.md` in the repo summarizing what shipped, what's known-broken, and what's deferred.
- Update `CHANGELOG.md`.
- Tag a TestFlight build.

If you discover the spec is wrong or ambiguous, **stop and propose a delta** before coding around it. The spec is a contract; updating it is part of the work.

Build slowly. Build kindly. This app is going to hold the most important moments in people's lives.

— end of build prompt —

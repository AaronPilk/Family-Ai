# Good morning, Aaron 🌅

While you slept, here's what landed in the working tree. Everything compiles. Nothing is deployed yet — read this top-to-bottom before pushing.

---

## What got built tonight

### 1. Twilio SMS invites
- **Edge function** at `supabase/functions/send_sms_invite/index.ts` that calls the Twilio REST API with E.164-normalized phone numbers, rate-limited to 10 SMS/hour per sender.
- **New table** `sms_invite_log` for audit + rate-limit tracking (migration `20260522000007_sms_invite_log.sql`).
- **UI** added to `/invite` screen: phone number input below the share-link card, "Send invite" button, success toast with masked number, "Recently sent" list at the bottom.
- **You need to set up Twilio** (see Setup checklist below).

### 2. Vault — proof-of-life release flow
- **New tables** in migration `20260522000010_vault_releases.sql`:
  - `proof_vault_items` — append-only journal entries. A trigger blocks all UPDATE and DELETE. Server-stamped `created_at`. Once a row lands, it is forensic — can't be edited or backdated.
  - `vault_releases` — one row per (author, recipient) scope. Conditions: release now / unlock on date / unlock when they join. Revocable.
  - `can_view_proof_vault_item()` security-definer function powering RLS so recipients only see items their unlock condition allows.
- **New screens**:
  - `/vault` — author's journal with trust badge "🕒 SERVER-STAMPED · 🔒 APPEND-ONLY"
  - `/vault/add` — compose a new entry, server timestamps it immutably
  - `/vault/release` — pick recipient + condition, confirm the irrevocability, ship the release
  - `/vault/released-to-me` — chronological wall of someone else's vault, oldest first. Calm, no reactions, no replies — just for reading
  - `/vault/[id]` — single-item detail
- **Tab added back** to the bottom bar with a lock-closed icon.

### 3. Letters mode — recipient-controlled receipts
- **New table** `letters` in migration `20260522000008_letters.sql` with airtight privacy:
  - Sender can never UPDATE the table at all (no RLS policy gives them update)
  - `read_visible_to_sender` (null/false/true) + `decided_at` — when recipient makes their choice
  - A BEFORE UPDATE trigger enforces *one-way* permanence: null→false stays false forever, null→true stays true forever, false↔true is impossible even with service role
  - Sender's UI queries a SECURITY INVOKER view (`letters_for_sender`) that returns `visible_read_at = CASE WHEN read_visible_to_sender = true THEN read_at ELSE NULL END`. The view never exposes the actual choice — sender can't even tell if "Delivered" means "haven't decided" vs. "chose no"
- **New screens**:
  - `/letters` — Sent | Received segmented home
  - `/letters/compose` — recipient picker, body input (8000 char max, soft warn at 4000), confirmation modal ("you can't unsend")
  - `/letters/[id]` — recipient's envelope view on cream `#FAF3E7` background. Decision prompt revealed only after scroll-to-end OR 6-sec dwell timer. Yes/No is permanent.
  - `/letters/sender/[id]` — sender's view through the privacy-safe view
- **Realtime** wired so a sender's "Delivered" pill flips to "Read 2h ago" the instant the recipient chooses Yes. Stays "Delivered" forever if they choose No.
- **Entry point** added to the Family tab.

### 4. Onboarding + profile editing
- **4-step onboarding flow** at `/onboarding/welcome` → `/how-it-works` → `/role` → `/invite`:
  - Welcome with first name + tagline
  - Three modes explained (Events, Stories, Letters+Vault "coming soon")
  - Role picker: parent/grandparent ("elder"), middle, child/grandchild
  - Invite-or-skip ending that flips `onboarding_completed = true`
- **`/profile`** auto-saving editor: display name, birthday (MM/DD/YYYY), role re-picker, sign out. Avatar upload stubbed as "coming soon."
- **Root gate** at `app/index.tsx` reads `profiles.onboarding_completed` and routes accordingly. After sign-up: onboarding. After cold start: tabs (if completed) or onboarding (if not).
- **Schema** in migration `20260522000009_onboarding_and_profile.sql`: adds `profiles.onboarding_completed boolean` + `profiles.role text`.
- **Profile chip** added to Family tab top-right (initials avatar) — taps into `/profile`.

---

## Setup checklist — what YOU need to do this morning

In order:

### Step 1: Push the migrations to the hosted Supabase

```bash
cd ~/Family\ AI/Family-Ai
supabase db push --linked
```

It'll apply 5 new migrations:
- `20260522000005_memory_items_rls_patch.sql` (Daily Questions support)
- `20260522000006_profiles_is_dev.sql` (admin flag — already there or not, push will skip)
- `20260522000007_sms_invite_log.sql` (Twilio audit log)
- `20260522000008_letters.sql` (Letters table + privacy trigger)
- `20260522000009_onboarding_and_profile.sql` (onboarding columns on profiles)
- `20260522000010_vault_releases.sql` (Vault proof-of-life tables + RLS)

If any migration errors, paste the output to me and we'll patch.

### Step 2: Set up Twilio (only if you want SMS — share-link works without this)

1. Sign up at twilio.com (free trial gives ~$15 credit; ~$0.0083/SMS for US)
2. Console → **Phone Numbers** → **Buy a number** with SMS capability
3. Console → **Account Info** copy: Account SID, Auth Token
4. In terminal:
   ```bash
   cd ~/Family\ AI/Family-Ai
   supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
   supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
   supabase secrets set TWILIO_PHONE_NUMBER=+15551234567
   ```
5. Deploy the edge function:
   ```bash
   supabase functions deploy send_sms_invite
   ```
6. Test from the app: go to `/invite`, type your own phone, hit "Send invite" — you should get an SMS in 5-15 seconds.

**Heads up on A2P 10DLC:** If you plan to send more than a handful of SMS per day, Twilio requires registering your number for "A2P 10DLC." Skip for now; the free trial handles low volume.

### Step 3: Commit and push everything

```bash
cd ~/Family\ AI/Family-Ai
git add .
git status   # eyeball the file list
git commit -m "Overnight: Twilio SMS, Vault release flow, Letters mode, Onboarding + profile"
git push origin main
```

Vercel will auto-rebuild in 4-7 minutes.

### Step 4: Smoke test on famlinkapp.com

In **incognito** so you start fresh:
1. Open famlinkapp.com → sign up with `aaron+test1@skyway.media`
2. Confirm email → land at `/onboarding/welcome`
3. Walk the 4-step onboarding, pick "I'm a parent or grandparent"
4. Tap "Invite your family" → land at `/invite`
5. Tap "Share Link" → SMS the URL to yourself
6. Sign up on second device or browser with `aaron+test2@skyway.media`
7. Open the SMS link → should auto-claim into Aaron's family circle
8. On both accounts, watch the DEMO banner disappear (because each circle now has 2 members)
9. Try creating an event, sending a letter, adding a vault entry, releasing it

---

## What's still TODO (post-launch batch)

- **Photo / video uploads** — currently stubbed everywhere. Supabase Storage bucket + helper component needed.
- **Push notifications** — web push on iOS 16.4+ requires extra setup; native APNs/FCM for the app-store build later.
- **Account deletion** — currently `comingSoon`. Will need a cascade-delete RPC.
- **Vault join-locked recipient resolution** — a release set to "unlock when they join" with only an email needs to be wired to populate `recipient_user_id` when the invitee signs up. The shape is ready, just needs glue.
- **Cron job for time-locked vault unlock** — currently the unlock condition is evaluated at read time (`can_view_proof_vault_item` checks `unlock_at <= now()`). Works fine but no notification when an unlock date arrives. Cron could fire a notification when the date hits.
- **Twilio A2P 10DLC** — required for production-volume SMS. Set up only when needed.

---

## Files changed/created tonight (high-level)

```
supabase/functions/send_sms_invite/index.ts         NEW
supabase/functions/send_sms_invite/README.md        NEW
supabase/migrations/20260522000007_sms_invite_log.sql   NEW
supabase/migrations/20260522000008_letters.sql      NEW
supabase/migrations/20260522000009_onboarding_and_profile.sql  NEW
supabase/migrations/20260522000010_vault_releases.sql   NEW

apps/mobile/src/lib/supabaseVault.ts                NEW
apps/mobile/src/lib/supabaseLetters.ts              NEW
apps/mobile/src/lib/useProfile.ts                   NEW
apps/mobile/src/components/VaultTrustBadge.tsx      NEW

apps/mobile/src/app/vault/index.tsx                 REWRITTEN
apps/mobile/src/app/vault/add.tsx                   NEW
apps/mobile/src/app/vault/release.tsx               NEW
apps/mobile/src/app/vault/released-to-me.tsx        NEW
apps/mobile/src/app/vault/[id].tsx                  REWRITTEN

apps/mobile/src/app/letters/index.tsx               NEW
apps/mobile/src/app/letters/compose.tsx             NEW
apps/mobile/src/app/letters/[id].tsx                NEW
apps/mobile/src/app/letters/sender/[id].tsx        NEW

apps/mobile/src/app/onboarding/welcome.tsx          NEW
apps/mobile/src/app/onboarding/role.tsx             NEW
apps/mobile/src/app/onboarding/how-it-works.tsx     REWRITTEN
apps/mobile/src/app/onboarding/invite.tsx           REWRITTEN
apps/mobile/src/app/onboarding/_shared.tsx          NEW

apps/mobile/src/app/profile/index.tsx               NEW
apps/mobile/src/app/(tabs)/_layout.tsx              EDITED (Vault tab added)
apps/mobile/src/app/(tabs)/family.tsx               EDITED (Letters entry, profile chip)
apps/mobile/src/app/invite/index.tsx                EDITED (SMS card + recent sends)
apps/mobile/src/app/index.tsx                       EDITED (root gate reads onboarding_completed)
```

Typecheck on `apps/mobile`: **PASS** (0 errors).

---

When you're ready, push migrations → set Twilio secrets → deploy edge function → commit + push code → smoke test on famlinkapp.com. I'll be here to debug whatever breaks. ☕

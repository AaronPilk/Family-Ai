# Security Review — Kin Batch 0

**Scope:** `packages/db/migrations/*.sql` (Postgres schema + RLS policies), `supabase/functions/*/index.ts` (Edge Function stubs), `apps/mobile/src/lib/supabase.ts` (client wiring).

**Goal:** Identify everything that needs to be fixed _before_ Batch 1 wires real Supabase auth and lets users put real family memories into the system. The mobile app is mock-data only right now; the SQL is intended to be production-grade.

**Posture:** Treat this as the gate between "demo" and "you can hand the app to Linda."

---

## Critical (must fix before going live)

### C1. `question_recipients_recipient_update` lets recipients tamper with the answer link

`packages/db/migrations/20260101000011_rls_policies.sql:202-203`

The UPDATE policy on `question_recipients` allows the recipient to update **any** column. That includes:

- `answered_memory_id` — they could point this at any memory they author, falsely claiming to have answered.
- `question_memory_id` — they could re-link their row to a different question.
- `status` — they can mark `answered` without actually creating an answer.

**Fix:** restrict columns. Either split into a column-level policy + check constraint, or wrap mutations in a `security definer` function `record_answer(question_id, answer_memory_id)` and revoke direct UPDATE.

```sql
-- Tighter:
create policy question_recipients_recipient_update on public.question_recipients
  for update using (auth.uid() = recipient_user_id)
  with check (
    auth.uid() = recipient_user_id
    -- forbid changing the immutable parts:
    -- (Postgres doesn't have column-level check in policies; use trigger instead)
  );

create function public.guard_question_recipients_update()
returns trigger language plpgsql as $$
begin
  if new.question_memory_id <> old.question_memory_id then
    raise exception 'question_memory_id is immutable';
  end if;
  if new.recipient_user_id <> old.recipient_user_id then
    raise exception 'recipient_user_id is immutable';
  end if;
  return new;
end;
$$;
create trigger question_recipients_guard before update on public.question_recipients
  for each row execute function public.guard_question_recipients_update();
```

### C2. `vault_items_creator_write` lets the creator pre-release a vault item

`packages/db/migrations/20260101000011_rls_policies.sql:274-275`

`for insert with check (auth.uid() = creator_user_id)` permits any `status` value at insert time. A malicious creator (or compromised client) could `INSERT … status='released'`, completely bypassing the release Edge Function and the cool-off windows that protect the recipient.

**Fix:** add a CHECK constraint that the initial status must be in `('sealed','scheduled','awaiting_verification')`. The release transition must come from `service_role` only, via the cron function.

```sql
alter table public.vault_items
  add constraint vault_items_initial_status
  check (status in ('sealed','scheduled','awaiting_verification','revoked'));

-- Then enforce 'released' only via service role:
create function public.transition_vault_item(item_id uuid, to_status text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.vault_items set status = to_status, released_at =
    case when to_status = 'released' then now() else released_at end
  where id = item_id;
$$;
revoke execute on function public.transition_vault_item from public;
-- service_role can still call it.
```

### C3. `family_memberships_self_insert` lets anyone join any circle

`packages/db/migrations/20260101000011_rls_policies.sql:122-123`

`for insert with check (auth.uid() = user_id)` — meaning if a user knows (or guesses) any `family_circles.id`, they can insert a membership row and join. RLS alone is not enough; the policy assumes the client is well-behaved.

**Fix:** require a valid, unconsumed `invites` row for this `user_id` + `circle_id`, OR funnel all joins through a `security definer` function `accept_invite(invite_token)` and revoke direct INSERT.

```sql
drop policy family_memberships_self_insert on public.family_memberships;
revoke insert on public.family_memberships from authenticated;

create function public.accept_invite(invite_token text)
returns public.family_memberships
language plpgsql security definer set search_path = public as $$
declare
  inv public.invites;
  m public.family_memberships;
begin
  select * into inv from public.invites
    where token = invite_token and status = 'pending' and expires_at > now()
    for update;
  if inv is null then raise exception 'invalid or expired invite'; end if;

  insert into public.family_memberships (circle_id, user_id, role)
    values (inv.circle_id, auth.uid(), 'member')
    returning * into m;

  update public.invites set status = 'accepted' where id = inv.id;
  return m;
end;
$$;
```

### C4. Soft-delete is not consistently enforced across SELECT policies

`packages/db/migrations/20260101000011_rls_policies.sql:170, 248-261, 280-293`

`memory_items_visible` filters `deleted_at is null` (good). But `timeline_placements_visible`, `transcriptions_via_media`, `ai_tags_via_memory`, `embeddings_via_memory`, and `memory_media_via_memory` use `exists (select 1 from public.memory_items m where m.id = …)` _without_ filtering on `m.deleted_at`. Result: deleted memories still leak via their placements, transcriptions, tags, and media joins.

**Fix:** add `and m.deleted_at is null` to every join in those policies. Better: centralize the visibility check into a helper function `can_see_memory(viewer_id, memory_id)` and call it everywhere.

```sql
create function public.can_see_memory(viewer_id uuid, memory_id uuid)
returns boolean stable security definer set search_path = public as $$
  select m.deleted_at is null and (
    viewer_id = m.author_user_id
    or (
      public.is_circle_member(viewer_id, m.circle_id)
      and public.visibility_allows(viewer_id, m.visibility_rule_id, m.circle_id, m.author_user_id)
    )
  )
  from public.memory_items m
  where m.id = memory_id;
$$;
```

Then rewrite `memory_items_visible`, `timeline_placements_visible`, `media_assets_owner_or_referenced`, `ai_tags_via_memory`, `embeddings_via_memory`, `memory_media_via_memory` to call `public.can_see_memory(auth.uid(), memory_id)`. Single source of truth.

---

## High

### H1. `memory_items_author_update` lets authors mutate immutable fields

`packages/db/migrations/20260101000011_rls_policies.sql:178-180`

Authors can change `circle_id`, `kind`, `author_user_id`, `related_question_id`, `parent_memory_id`, `imported_source` on existing rows. Most of those should be immutable post-insert. Imagine an author moving a memory from one circle to another (visibility just broke) or re-targeting an answer at a different question.

**Fix:** BEFORE UPDATE trigger that rejects changes to immutable columns.

### H2. `media_assets` SELECT policy never validates the parent memory isn't deleted

`packages/db/migrations/20260101000011_rls_policies.sql:208-224`

Same theme as C4 — the `exists` subquery in `media_assets_owner_or_referenced` joins `memory_items` without filtering `m.deleted_at`. Deleted memories still leak their media. Fix in the same centralization pass as C4.

### H3. Missing UPDATE policy on `relationships` for the counter-party

`packages/db/migrations/20260101000011_rls_policies.sql:128-132`

`relationships_self_write` is INSERT-only. There's no UPDATE policy, so `confirmed_by_to` can never be flipped from the client — relationship confirmation is broken. Add:

```sql
create policy relationships_confirmation on public.relationships
  for update using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);
-- And block changes to any field except confirmed_by_to via trigger.
```

### H4. `profiles_circle_read` doesn't respect `users.deleted_at`

`packages/db/migrations/20260101000011_rls_policies.sql:90-102`

If a user soft-deletes their account, their profile is still readable by every circle member. Add: `and (select deleted_at from public.users where id = public.profiles.user_id) is null`. (Or centralize the "user is active" check the same way as memory visibility.)

### H5. No UPDATE/DELETE policies for admins on `family_circles` or `family_memberships`

`packages/db/migrations/20260101000011_rls_policies.sql:113-123`

There's no way through RLS for an admin to:

- Rename or soft-delete their circle.
- Remove a member (set `removed_at`).
- Promote a member to admin.

Currently those operations are impossible from the client; only `service_role` can do them. That might be the design — but the spec says (§I) admins can remove members. Add explicit admin-role policies.

### H6. The vault status table is silently locked from client updates

`packages/db/migrations/20260101000011_rls_policies.sql:268-275`

`vault_items` has SELECT + INSERT policies, no UPDATE or DELETE. That's safe (only `service_role` can release), but a future engineer will scratch their head. Add an explicit _empty_ UPDATE policy or a comment block: `-- vault_items UPDATE is intentionally service_role-only; release transitions happen via release_vault_items edge function`.

---

## Medium

### M1. AI artifact tables silently block writes

`packages/db/migrations/20260101000011_rls_policies.sql:280-296`

`transcriptions`, `ai_tags`, `embeddings`, `prompt_suggestions` have RLS enabled with SELECT-only policies. INSERT/UPDATE/DELETE are blocked for all roles except `service_role`. This is correct (only the server writes them via Edge Functions), but it's invisible. Add a comment explaining the design + a `revoke` line for clarity.

### M2. `timeline_placements_visible` duplicates the visibility logic

`packages/db/migrations/20260101000011_rls_policies.sql:248-261`

The exact `is_circle_member + visibility_allows` block appears in `memory_items_visible` and `timeline_placements_visible`. If they drift, you get inconsistent enforcement. Fold into the `can_see_memory` helper from C4.

### M3. `relationships_self_write` lets you create a relationship to a non-member

`packages/db/migrations/20260101000011_rls_policies.sql:128-132`

The policy ensures `auth.uid()` is _one of_ the parties, but doesn't ensure _both_ parties are circle members. You could create a relationship to a random user UUID who has no membership in that circle.

**Fix:**

```sql
create policy relationships_self_write on public.relationships
  for insert with check (
    public.is_circle_member(from_user_id, circle_id)
    and public.is_circle_member(to_user_id, circle_id)
    and (auth.uid() = from_user_id or auth.uid() = to_user_id)
  );
```

### M4. `is_circle_member` doesn't check `family_circles.deleted_at`

`packages/db/migrations/20260101000011_rls_policies.sql:7-21`

A soft-deleted circle still returns true for `is_circle_member` if memberships exist. Edge case (the only way to soft-delete a circle is via service_role), but tighten when convenient.

### M5. No INSERT/UPDATE/DELETE policy on `audit_log`

`packages/db/migrations/20260101000011_rls_policies.sql:304-313`

Only a SELECT policy for admins. The audit log is service_role-write-only. Correct, but document and `revoke insert, update, delete on public.audit_log from authenticated, anon`.

### M6. Edge Function stubs don't yet handle service-role keys

`supabase/functions/*/index.ts`

When implemented, every Edge Function must:

- Initialize `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })` — never `EXPO_PUBLIC_*` keys.
- Validate the trigger payload (don't trust `media_id` came from a real INSERT trigger — look it up).
- Use `set local role authenticated` or scoped JWTs when performing operations that should respect a specific user's RLS context, instead of bypassing RLS via service_role.
- Log only the payload shape (counts, hashes), never content (transcripts, bodies).

### M7. Storage paths in `media_assets.storage_path` are not validated

`packages/db/migrations/20260101000006_media.sql:11`

It's a free-form `text` column. A malicious client could insert `storage_path = '../other_users/secret.mp4'` and abuse signed-URL logic that naively concatenates paths. Validate format (e.g., regex `^[a-z0-9-]+/[a-f0-9-]{36}\.(jpg|mp4|m4a|webm)$`) via CHECK constraint or trigger before any signed-URL minting goes live.

---

## Low / Nit

- **N1.** Policy naming is inconsistent: `memory_items_visible` vs `users_self_read` vs `family_circles_member_read`. Pick `_select`/`_insert`/`_update`/`_delete` suffixes and standardize.
- **N2.** No rollback migration. The header says "rollback omitted in template; recreate from a prior migration" — acceptable for v0, but the next migration in this chain should include explicit drops.
- **N3.** `audit_log_circle_admin` line 304: the admin-role check could be folded into a helper `is_circle_admin(viewer_id, circle_id)` for reuse.
- **N4.** `apps/mobile/src/lib/supabase.ts` warns to console when env vars are missing. Confirm `console.warn` doesn't ship to production telemetry (Sentry/PostHog) carrying any env detail. Currently it doesn't, but worth adding a comment.
- **N5.** `.env.example` doesn't include `SUPABASE_DB_URL` or `SUPABASE_PROJECT_ID` — add them for CLI usage when wiring real Supabase.
- **N6.** CI workflow `db-validate` runs `supabase db reset --debug` — that's noisy. Drop `--debug` once the migrations are stable.

---

## Greenlight to wire real auth?

**Not yet.** Fix the four Critical items (C1–C4) and at minimum H1, H3, H6 before Batch 1 lands real Supabase auth. The schema design is sound and the visibility model is good; the gaps are in policy _completeness_, not in the architecture. Plan: one tightening migration `20260101000012_rls_hardening.sql` that introduces `can_see_memory()`, swaps the duplicated visibility logic, adds the `accept_invite()` function, adds the vault status constraint, and adds the immutability triggers on `memory_items` + `question_recipients`. After that, write the property tests called out in spec §I to lock the behavior in. Then Batch 1.

— Internal review pass, May 2026

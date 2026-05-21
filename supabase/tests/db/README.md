# Database tests

pgTAP property tests that lock in the RLS hardening invariants from
`docs/SECURITY-REVIEW.md`. These run after `supabase db reset` and must pass
before real auth gets wired to a hosted Supabase project. See
`docs/GO-LIVE-PLAN.md` Batch A for context.

## Run them

```bash
pnpm db:start            # boot local Supabase if it isn't already
pnpm db:reset            # apply all migrations into a clean db
pnpm db:test             # run every *_test.sql file under this directory
```

## File layout

- `00_setup.sql` — pgTAP extension + helper fixtures + role-switching helpers.
  Runs before each test file. Defines `tests.fixture_user`, `tests.fixture_circle`,
  `tests.set_role_authed`, etc.
- `c1_recipient_immutable_test.sql` — proves question_recipients tamper guard
  (C1 in SECURITY-REVIEW.md).
- `c2_vault_sealed_only_test.sql` — proves the vault state machine forbids
  client-initiated `released` status (C2).
- `c3_invite_required_test.sql` — proves direct INSERT into family_memberships
  is blocked, and `accept_invite()` is the only valid path (C3).
- `c4_soft_delete_propagation_test.sql` — proves soft-deleted memories hide
  every dependent row (placements, transcriptions, ai_tags) via
  `can_see_memory()` (C4).

## Writing new tests

Each file starts with `begin; select plan(N);` and ends with
`select * from finish(); rollback;` — the rollback ensures tests don't bleed
state into one another. Use the helpers in `00_setup.sql` rather than hand-
rolling auth.users/family_circles rows.

## What's not covered yet

The High and Medium findings from the security review (H1–H5, M1–M7) aren't
tested. Add them as `h1_*_test.sql`, `m7_*_test.sql`, etc. as we resolve
each one.

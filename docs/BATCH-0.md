# Batch 0 — Scaffold (shipped)

## What landed

- Monorepo (`apps/`, `packages/`, `supabase/`, `docs/`)
- Expo + TS app skeleton with expo-router, 5-tab layout, Tamagui config, design tokens
- Supabase config + Edge Function stubs (`transcribe_media`, `tag_memory`, `release_vault_items`)
- Full v1 schema as ordered SQL migrations (`packages/db/migrations/*`)
- RLS policies + helper functions (`*_rls_policies.sql`)
- Seed data (`prompt_templates.sql`)
- `@kin/shared` (types + zod schemas)
- `@kin/ui` (Button, Card, VisibilityChip, Avatar starters)
- CI workflow (format check + typecheck + db migration validate)
- `docs/SPEC.md`, `docs/ARCHITECTURE.md`

## Known gaps (intentional — these belong to later batches)

- No real auth — sign-in screen is a placeholder (Batch 1).
- Tab screens are placeholders (Batch 2+).
- Edge Functions are stubs that log and return (Batches 7 & 9).
- No tests yet — RLS property tests land in Batch 1.
- No assets in `apps/mobile/assets/` — provide icon/splash before EAS build.

## To verify this batch locally

```bash
pnpm install
supabase start
supabase db reset      # applies all 11 migrations + seed
pnpm db:types
pnpm typecheck
pnpm ios
```

Expected end state: app boots, lands on Welcome, sign-in shows disabled buttons, tabs render placeholders.

## Next

Start **Batch 1 — Auth & profile** (SPEC §N).

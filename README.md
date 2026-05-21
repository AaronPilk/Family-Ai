# Kin

> A private family memory network. Ask anything. Save every answer.

Kin captures the small questions you think to ask your family — *"what did you eat with Chicken in a Biskit crackers?"*, *"what music were you listening to at my age?"* — and turns the answers into a permanent, organized, two-sided story for every relationship in your family.

The full product spec lives in [`docs/SPEC.md`](docs/SPEC.md). It is the source of truth. Read it before changing schema, visibility, or core flows.

---

## Status

Batch 0: monorepo scaffold and migrations.
See [`docs/SPEC.md` §N](docs/SPEC.md) for the full build plan. Next up: **Batch 1 — Auth & profile.**

## Stack

- **Mobile**: React Native + Expo + TypeScript, Tamagui, expo-router, Reanimated 3
- **Backend**: Supabase — Postgres (with `pgvector`, `pg_trgm`, `pg_cron`), Auth, Storage, Edge Functions, Realtime
- **AI**: OpenAI Whisper / Deepgram (transcription), Anthropic Claude (tagging + summaries), OpenAI / Voyage embeddings
- **State**: TanStack Query (server) + Zustand (UI)
- **Push**: Expo Push
- **Telemetry**: PostHog (no-content events), Sentry

Stack rationale is in [`docs/SPEC.md` §G](docs/SPEC.md).

## Repo layout

```
.
├── apps/
│   └── mobile/             — Expo app (the iOS client)
├── packages/
│   ├── db/                 — SQL migrations, seeds
│   ├── shared/             — Domain types + zod schemas
│   └── ui/                 — Tamagui components shared across apps
├── supabase/
│   ├── config.toml         — local + cloud Supabase config
│   ├── functions/          — Edge Function stubs (transcribe, tag, vault release)
│   └── policies/           — Notes on RLS (policies live in db migrations)
├── docs/
│   └── SPEC.md             — full product spec (source of truth)
├── .github/workflows/      — CI
└── package.json            — monorepo root
```

## Getting started

### Prerequisites
- Node 20.11+ (use `.nvmrc`)
- pnpm 9+
- Xcode 15+ (for iOS) / Android Studio (for Android)
- Docker (for local Supabase)
- Supabase CLI: `brew install supabase/tap/supabase`

### Setup

```bash
# 1) Install
pnpm install

# 2) Start local Supabase (applies migrations + seeds via supabase/seed.sql)
supabase start

# 3) Copy env
cp .env.example apps/mobile/.env
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from `supabase status`

# 4) Generate TS types from the live DB
pnpm db:types

# 5) Run the app
pnpm ios       # or `pnpm android` / `pnpm dev` for Expo Dev tools
```

### Common scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Expo dev server |
| `pnpm ios` / `pnpm android` | Run on simulator |
| `pnpm typecheck` | TS check across the monorepo |
| `pnpm format` | Prettier on everything |
| `pnpm db:reset` | Reset local DB + reapply all migrations + seed |
| `pnpm db:diff` | Diff local schema vs migrations (catches drift) |
| `pnpm db:types` | Regenerate Supabase types into `packages/shared` |

## How a single answer fans out

A video answer from Mom to Aaron lives in **one** `media_assets` row and **one** `memory_items` row, then appears in many timelines via `timeline_placements`. The full walkthrough is in [`docs/SPEC.md` §H](docs/SPEC.md).

## Privacy posture

All reads and writes go through Postgres Row-Level Security. The client cannot bypass. Visibility rules are first-class rows referenced by every piece of content. See [`docs/SPEC.md` §I](docs/SPEC.md) for the trust thesis and the full RLS sketch — implemented in `packages/db/migrations/*_rls_policies.sql`.

## Contributing rules

1. Never bypass RLS in app code. Use the user session's anon key; service-role lives only in Edge Functions.
2. Spec first. If you need a new field, route, or visibility scope, update `docs/SPEC.md` and the schema in the same PR.
3. One concern per migration. Migrations are forward-only.
4. TS strict mode. No `any`.
5. No content in telemetry. Hashes, counts, durations only.

## License

TBD (recommend BSL or proprietary). Do not redistribute without permission.

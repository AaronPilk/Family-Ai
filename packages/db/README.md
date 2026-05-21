# @kin/db

SQL source of truth for Kin's Postgres schema, RLS policies, and seed data.

## Layout

- `migrations/` — ordered, timestamped SQL files. Forward-only; never edit a merged migration.
- `seeds/` — seed data (e.g., guided prompt templates).

## Running locally

From the repo root:

```bash
pnpm db:start         # starts a local Supabase (Docker)
pnpm db:reset         # applies all migrations + seeds from a clean DB
pnpm db:types         # regenerates TS types into packages/shared/src/database.types.ts
```

## Migration conventions

- One concern per migration where practical (identity, family, content, etc.).
- Always include a `-- forward` and `-- rollback` block.
- RLS policies live in their own migration (`*_rls_policies.sql`) so they can be reviewed in isolation.
- Never write `DROP TABLE` in a forward migration without an explicit safety comment.

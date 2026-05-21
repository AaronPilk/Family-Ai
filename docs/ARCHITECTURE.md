# Architecture (one-page)

A condensed map of how the pieces fit. Full detail in `SPEC.md`.

## Request paths

### Reads (e.g., loading a relationship timeline)

1. Mobile app uses the **anon** Supabase key + the user's session JWT.
2. Postgres applies RLS — the user only sees `memory_items` whose visibility rule allows them.
3. Server returns the rows; signed URLs for `media_assets` are minted by `storage` only after the read passes RLS.

### Writes (e.g., posting an answer)

1. App writes to a local **outbox** (MMKV/SQLite) and renders optimistically.
2. Worker drains the outbox: uploads media → inserts `media_assets` → inserts `memory_items` (kind=`answer`) → updates `question_recipients` → links `memory_media`.
3. Postgres triggers create `timeline_placements` for personal + relationship timelines.
4. Storage trigger enqueues `transcribe_media`.
5. After transcription, `tag_memory` is invoked → `ai_tags` → trigger places into topic timelines.
6. Notifications and push fire.

## Background jobs

| Job                   | Trigger                                    | Sink                                     |
| --------------------- | ------------------------------------------ | ---------------------------------------- |
| `transcribe_media`    | new `media_assets` (audio/video)           | `transcriptions`                         |
| `tag_memory`          | new `memory_items` of taggable kinds       | `ai_tags` + topic placements             |
| `embed_memory`        | new `memory_items` with body or transcript | `embeddings`                             |
| `release_vault_items` | `pg_cron` every 15 min                     | vault state transition, placements, push |
| `weekly_digest`       | `pg_cron` weekly per user                  | email + in-app notification              |

## Data fan-out (canonical example)

See SPEC §H "How a single answer fans out."

## Trust boundary

- Anon key + RLS = the trust boundary for all client reads/writes.
- Service-role key = only in Edge Functions, never on device.
- Vault items get an extra envelope encryption pass in Phase 2 (per-family KMS-wrapped key).
